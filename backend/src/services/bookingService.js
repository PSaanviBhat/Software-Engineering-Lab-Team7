const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

const TX_OPTIONS = { maxWait: 10000, timeout: 10000 };

async function createBooking({ learnerId, slotId, note }) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialise this learner's bookings so two parallel requests for overlapping
      // slots cannot both pass the overlap check. Always lock learner before slot.
      const learners = await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${learnerId} FOR UPDATE`;
      if (learners.length === 0) throw new AppError(401, "UNAUTHORIZED", "User not found");

      // Lock the slot row; concurrent requests for the same slot queue up here.
      const slots = await tx.$queryRaw`SELECT * FROM "Slot" WHERE id = ${slotId} FOR UPDATE`;
      const slot = slots[0];
      if (!slot) throw new AppError(404, "SLOT_NOT_FOUND", "Slot not found");
      if (slot.tutorId === learnerId) {
        throw new AppError(403, "OWN_SLOT", "You cannot book your own slot");
      }
      if (slot.startUtc <= new Date()) {
        throw new AppError(400, "SLOT_IN_PAST", "Slot has already started");
      }
      if (slot.status !== "FREE") throw new AppError(409, "SLOT_TAKEN", "Slot is already booked");

      // existing.start < new.end AND existing.end > new.start (UTC)
      const clash = await tx.booking.findFirst({
        where: {
          learnerId,
          status: "CONFIRMED",
          slot: { startUtc: { lt: slot.endUtc }, endUtc: { gt: slot.startUtc } },
        },
        select: { id: true },
      });
      if (clash) {
        throw new AppError(
          409,
          "LEARNER_OVERLAP",
          "You already have a booking that overlaps this time",
          {},
          { clashingBookingId: clash.id }
        );
      }

      const booking = await tx.booking.create({ data: { slotId, learnerId, note } });
      await tx.slot.update({ where: { id: slotId }, data: { status: "BOOKED" } });

      return {
        bookingId: booking.id,
        slotId: slot.id,
        start: slot.startUtc.toISOString(),
        end: slot.endUtc.toISOString(),
        status: booking.status,
      };
    }, TX_OPTIONS);
  } catch (err) {
    // Backstop: Booking_slotId_active_key rejected a second CONFIRMED booking for the slot.
    if (err.code === "P2002") throw new AppError(409, "SLOT_TAKEN", "Slot is already booked");
    throw err;
  }
}

module.exports = { createBooking };
