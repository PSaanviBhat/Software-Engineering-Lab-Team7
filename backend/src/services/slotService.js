const prisma = require("../lib/prisma");

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
  const slot = await prisma.slot.create({
    data: { tutorId, subject, startUtc, endUtc, mode, link },
  });
  return toDto(slot);
}

module.exports = { createSlot };
