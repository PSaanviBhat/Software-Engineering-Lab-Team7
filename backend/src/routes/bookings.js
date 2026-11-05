const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const AppError = require("../lib/AppError");
const bookingService = require("../services/bookingService");
const {
  enqueueConfirmation,
  scheduleReminders,
  cancelReminders, } = require("../services/notificationService");

const router = express.Router();

const createSchema = z.object({
  slotId: z.uuid(),
  note: z.string().max(500).optional(),
});

router.post("/", auth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Invalid booking request");

  const result = await bookingService.createBooking({
    learnerId: req.user.id,
    slotId: parsed.data.slotId,
    note: parsed.data.note,
  });
     // The booking is already saved. Not awaited on purpose: a slow or stopped Redis
   // must never delay or fail the response. Both functions catch their own errors.
  enqueueConfirmation(result.bookingId);
  scheduleReminders(result.bookingId, result.start);

  res.status(201).json(result);
});

router.get("/me", auth, async (req, res) => {
  res.json(await bookingService.listMyBookings(req.user.id));
});

router.delete("/:id", auth, async (req, res) => {
  const parsed = z.uuid().safeParse(req.params.id);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Invalid booking id");

  const result = await bookingService.cancelBooking({
    learnerId: req.user.id,
    bookingId: parsed.data,
  });
   // Remove the pending 24 h and 1 h reminders (the worker also skips them if they slip through).
  cancelReminders(result.bookingId);

  res.json(result);});

module.exports = router;
