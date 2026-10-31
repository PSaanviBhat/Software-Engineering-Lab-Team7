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

// Returns slots, optionally filtered.
// from (inclusive) / to (exclusive): time window
// subject: case-insensitive "contains" match
// tutorId: exact tutor
// mode: ONLINE or IN_PERSON
async function listSlots({ from, to, subject, tutorId, mode } = {}) {
  const where = {};

  if (from || to) {
    where.startUtc = {};
    if (from) where.startUtc.gte = from;
    if (to) where.startUtc.lt = to;
  }
  if (subject) where.subject = { contains: subject, mode: "insensitive" };
  if (tutorId) where.tutorId = tutorId;
  if (mode) where.mode = mode;

  const slots = await prisma.slot.findMany({
    where,
    orderBy: { startUtc: "asc" },
    include: { tutor: { select: { id: true, name: true } } },
  });

  return slots.map(toListDto);
}

// Tutors that currently have at least one slot (used for the tutor filter dropdown).
async function listTutorsWithSlots() {
  const tutors = await prisma.user.findMany({
    where: { slots: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return tutors;
}

module.exports = { listSlots, listTutorsWithSlots };
