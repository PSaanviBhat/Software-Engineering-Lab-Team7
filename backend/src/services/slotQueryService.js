const prisma = require("../lib/prisma");

function toListDto(slot) {
  return {
    id: slot.id,
    tutorId: slot.tutorId,
    tutorName: slot.tutor ? slot.tutor.name : null,
    subject: slot.subject,
    start: slot.startUtc.toISOString(),
    end: slot.endUtc.toISOString(),
    mode: slot.mode,
    status: slot.status,
  };
}

// Returns slots, optionally limited to a time window (from inclusive, to exclusive).
async function listSlots({ from, to } = {}) {
  const where = {};
  if (from || to) {
    where.startUtc = {};
    if (from) where.startUtc.gte = from;
    if (to) where.startUtc.lt = to;
  }

  const slots = await prisma.slot.findMany({
    where,
    orderBy: { startUtc: "asc" },
    include: { tutor: { select: { id: true, name: true } } },
  });

  return slots.map(toListDto);
}

module.exports = { listSlots };
