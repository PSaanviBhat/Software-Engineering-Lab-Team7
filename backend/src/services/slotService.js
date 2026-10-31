const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

function toDto(slot) {
  return {
    id: slot.id,
    tutorId: slot.tutorId,
    subject: slot.subject,
    start: slot.startUtc.toISOString(),
    end: slot.endUtc.toISOString(),
    mode: slot.mode,
    link: slot.link,
    status: slot.status,
  };
}

async function createSlot({ tutorId, subject, startUtc, endUtc, mode, link }) {
  // Two time ranges overlap when each one starts before the other ends.
  // Back-to-back slots (one ends exactly when the next starts) are allowed.
  const overlapping = await prisma.slot.findFirst({
    where: {
      tutorId,
      startUtc: { lt: endUtc },
      endUtc: { gt: startUtc },
    },
  });

  if (overlapping) {
    throw new AppError(
      409,
      "SLOT_OVERLAP",
      "You already have a slot that overlaps this time"
    );
  }

  const slot = await prisma.slot.create({
    data: { tutorId, subject, startUtc, endUtc, mode, link },
  });
  return toDto(slot);
}

module.exports = { createSlot };
