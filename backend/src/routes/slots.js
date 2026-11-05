const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const AppError = require("../lib/AppError");
const slotService = require("../services/slotService");
const slotQueryService = require("../services/slotQueryService");
const notificationService = require("../services/notificationService");

const router = express.Router();

const createSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  link: z.string().trim().max(500).optional(),
  repeatWeeks: z.number().int().min(1).max(8).optional(),
}).strict();

const listSchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  tutorId: z.string().trim().min(1).max(100).optional(),
  mode: z.enum(["ONLINE", "IN_PERSON"]).optional(),
}).strict();

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

  if (parsed.data.repeatWeeks !== undefined) {
    const result = await slotService.createRecurringSlots({
      tutorId: req.user.id,
      subject: parsed.data.subject,
      startUtc,
      endUtc,
      mode: parsed.data.mode,
      link: parsed.data.link,
      repeatWeeks: parsed.data.repeatWeeks,
    });
    return res.status(201).json(result);
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

const editSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  link: z.string().trim().max(500).optional(),
}).strict();

router.put("/:id", auth, requireRole("TUTOR"), async (req, res) => {
  const parsedId = z.uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid slot id");
  }

  const parsedBody = editSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid slot details");
  }

  const startUtc = new Date(parsedBody.data.start);
  const endUtc = new Date(parsedBody.data.end);

  if (endUtc <= startUtc) {
    throw new AppError(400, "INVALID_TIME_RANGE", "End time must be after start time");
  }
  if (startUtc <= new Date()) {
    throw new AppError(400, "SLOT_IN_PAST", "Slot must start in the future");
  }

  const slot = await slotService.updateSlot({
    tutorId: req.user.id,
    slotId: parsedId.data,
    subject: parsedBody.data.subject,
    startUtc,
    endUtc,
    mode: parsedBody.data.mode,
    link: parsedBody.data.link,
  });

  res.json(slot);
});

router.delete("/:id", auth, requireRole("TUTOR"), async (req, res) => {
  const parsedId = z.uuid().safeParse(req.params.id);
  if (!parsedId.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid slot id");
  }

  const { cancelledBookingIds } = await slotService.deleteSlot({
    tutorId: req.user.id,
    slotId: parsedId.data,
  });

  for (const bookingId of cancelledBookingIds) {
    await notificationService.cancelReminders(bookingId);
    await notificationService.enqueueSlotCancelled(bookingId);
  }

  res.status(204).send();
});

module.exports = router;
