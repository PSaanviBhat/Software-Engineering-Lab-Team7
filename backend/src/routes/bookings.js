const express = require("express");
const { z } = require("zod");
const tempAuth = require("../middleware/tempAuth");
const AppError = require("../lib/AppError");
const bookingService = require("../services/bookingService");

const router = express.Router();

const createSchema = z.object({
  slotId: z.uuid(),
  note: z.string().max(500).optional(),
});

router.post("/", tempAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Invalid booking request");

  const result = await bookingService.createBooking({
    learnerId: req.user.id,
    slotId: parsed.data.slotId,
    note: parsed.data.note,
  });
  res.status(201).json(result);
});

module.exports = router;
