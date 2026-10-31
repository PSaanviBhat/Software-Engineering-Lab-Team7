const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

const TX_OPTIONS = { maxWait: 10000, timeout: 10000 };
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;

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

async function listMyBookings(learnerId) {
  const bookings = await prisma.booking.findMany({
    where: { learnerId },
    include: { slot: { include: { tutor: { select: { id: true, name: true } } } } },
  });

  const now = new Date();
  const dtos = bookings.map((b) => ({
    bookingId: b.id,
    slotId: b.slotId,
    start: b.slot.startUtc.toISOString(),
    end: b.slot.endUtc.toISOString(),
    status: b.status,
    note: b.note,
    subject: b.slot.subject,
    mode: b.slot.mode,
    link: b.slot.link,
    tutorId: b.slot.tutor.id,
    tutorName: b.slot.tutor.name,
  }));

  // Upcoming first (soonest first), then past ones (most recent first).
  const isUpcoming = (d) => new Date(d.end) > now;
  const upcoming = dtos.filter(isUpcoming).sort((a, b) => a.start.localeCompare(b.start));
  const past = dtos.filter((d) => !isUpcoming(d)).sort((a, b) => b.start.localeCompare(a.start));
  return [...upcoming, ...past];
}

async function cancelBooking({ learnerId, bookingId }) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!found) throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    if (found.learnerId !== learnerId) {
      throw new AppError(403, "FORBIDDEN", "You can only cancel your own bookings");
    }

    // Same lock as createBooking, so cancelling and re-booking the slot cannot interleave.
    const slots = await tx.$queryRaw`SELECT * FROM "Slot" WHERE id = ${found.slotId} FOR UPDATE`;
    const slot = slots[0];

    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (booking.status !== "CONFIRMED") {
      throw new AppError(409, "ALREADY_CANCELLED", "Booking is already cancelled");
    }
    if (slot.startUtc.getTime() - Date.now() < CANCEL_CUTOFF_MS) {
      throw new AppError(
        409,
        "TOO_LATE_TO_CANCEL",
        "Bookings cannot be cancelled less than 2 hours before the start"
      );
    }

    await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    await tx.slot.update({ where: { id: slot.id }, data: { status: "FREE" } });

    return { ok: true, bookingId, slotId: slot.id, status: "CANCELLED" };
  }, TX_OPTIONS);
}

module.exports = { createBooking, listMyBookings, cancelBooking };
