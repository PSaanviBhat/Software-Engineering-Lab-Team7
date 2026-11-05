const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

async function createBooking({ learnerId, slotId, note }) {
  const learner = await prisma.user.findUnique({
    where: { id: learnerId },
    select: { verified: true },
  });
  if (!learner || !learner.verified) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before booking");
  }

  const slot = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!slot) throw new AppError(404, "SLOT_NOT_FOUND", "Slot not found");
  if (slot.tutorId === learnerId) {
    throw new AppError(403, "OWN_SLOT", "You cannot book your own slot");
  }
  if (slot.startUtc <= new Date()) {
    throw new AppError(400, "SLOT_IN_PAST", "Slot has already started");
  }
  if (slot.status !== "FREE") throw new AppError(409, "SLOT_TAKEN", "Slot is already booked");

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({ data: { slotId, learnerId, note } });
    await tx.slot.update({ where: { id: slotId }, data: { status: "BOOKED" } });
    return created;
  });

  return {
    bookingId: booking.id,
    slotId: slot.id,
    start: slot.startUtc.toISOString(),
    end: slot.endUtc.toISOString(),
    status: booking.status,
  };
}

async function listMyBookings(learnerId) {
  const bookings = await prisma.booking.findMany({
    where: { learnerId, status: "CONFIRMED" },
    orderBy: { slot: { startUtc: "asc" } },
    include: {
      slot: {
        include: {
          tutor: { select: { id: true, name: true } },
        },
      },
    },
  });

  return bookings.map((booking) => ({
    bookingId: booking.id,
    slotId: booking.slot.id,
    subject: booking.slot.subject,
    mode: booking.slot.mode,
    link: booking.slot.link,
    tutor: booking.slot.tutor,
    start: booking.slot.startUtc.toISOString(),
    end: booking.slot.endUtc.toISOString(),
    status: booking.status,
  }));
}

module.exports = { createBooking, listMyBookings };
