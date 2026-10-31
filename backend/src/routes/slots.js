const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const AppError = require("../lib/AppError");
const slotService = require("../services/slotService");
const slotQueryService = require("../services/slotQueryService");

const router = express.Router();

const createSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  link: z.string().trim().max(500).optional(),
});

const listSchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  tutorId: z.string().trim().min(1).max(100).optional(),
  mode: z.enum(["ONLINE", "IN_PERSON"]).optional(),
});

// Tutors who have slots, for the filter dropdown (any logged-in user).
router.get("/tutors", auth, async (req, res) => {
  const tutors = await slotQueryService.listTutorsWithSlots();
  res.json(tutors);
});

// Browse slots (any logged-in user).
// Optional filters: ?from=&to= (ISO datetimes), ?subject=, ?tutorId=, ?mode=ONLINE|IN_PERSON
router.get("/", auth, async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid filter values");
  }

  const slots = await slotQueryService.listSlots({
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    subject: parsed.data.subject,
    tutorId: parsed.data.tutorId,
    mode: parsed.data.mode,
  });

  res.json(slots);
});

router.post("/", auth, requireRole("TUTOR"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid slot details");
  }

  const startUtc = new Date(parsed.data.start);
  const endUtc = new Date(parsed.data.end);

  if (endUtc <= startUtc) {
    throw new AppError(400, "INVALID_TIME_RANGE", "End time must be after start time");
  }
  if (startUtc <= new Date()) {
    throw new AppError(400, "SLOT_IN_PAST", "Slot must start in the future");
  }

  const slot = await slotService.createSlot({
    tutorId: req.user.id,
    subject: parsed.data.subject,
    startUtc,
    endUtc,
    mode: parsed.data.mode,
    link: parsed.data.link,
  });

  res.status(201).json(slot);
});

module.exports = router;
