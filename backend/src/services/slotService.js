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

/**
 * Checks if a time range overlaps with any existing slots for a tutor.
 * @param {object} params
 * @param {string} params.tutorId
 * @param {Date} params.startUtc
 * @param {Date} params.endUtc
 * @param {string} [params.excludeSlotId]
 * @param {object} [params.client] - Prisma client or transaction instance
 * @returns {Promise<object|null>} The first overlapping slot, or null if none
 */
async function findOverlappingSlot({
  tutorId,
  startUtc,
  endUtc,
  excludeSlotId,
  client = prisma,
}) {
  const where = {
    tutorId,
    startUtc: { lt: endUtc },
    endUtc: { gt: startUtc },
  };
  if (excludeSlotId) {
    where.id = { not: excludeSlotId };
  }
  return client.slot.findFirst({ where });
}

async function createSlot({ tutorId, subject, startUtc, endUtc, mode, link }) {
  // Two time ranges overlap when each one starts before the other ends.
  // Back-to-back slots (one ends exactly when the next starts) are allowed.
  const overlapping = await findOverlappingSlot({ tutorId, startUtc, endUtc });

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

async function createRecurringSlots({
  tutorId,
  subject,
  startUtc,
  endUtc,
  mode,
  link,
  repeatWeeks,
}) {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const instances = [];
  for (let i = 0; i < repeatWeeks; i++) {
    const instStart = new Date(startUtc.getTime() + i * SEVEN_DAYS_MS);
    const instEnd = new Date(endUtc.getTime() + i * SEVEN_DAYS_MS);
    instances.push({
      startUtc: instStart,
      endUtc: instEnd,
    });
  }

  return prisma.$transaction(async (tx) => {
    const conflictingStarts = [];

    for (const inst of instances) {
      const overlapping = await findOverlappingSlot({
        tutorId,
        startUtc: inst.startUtc,
        endUtc: inst.endUtc,
        client: tx,
      });
      if (overlapping) {
        conflictingStarts.push(inst.startUtc.toISOString());
      }
    }

    if (conflictingStarts.length > 0) {
      throw new AppError(
        409,
        "SLOT_OVERLAP",
        "You already have a slot that overlaps this time",
        {
          conflicts: conflictingStarts,
          conflictingStarts,
        }
      );
    }

    const createdSlots = [];
    for (const inst of instances) {
      const slot = await tx.slot.create({
        data: {
          tutorId,
          subject,
          startUtc: inst.startUtc,
          endUtc: inst.endUtc,
          mode,
          link,
        },
      });
      createdSlots.push(slot);
    }

    return {
      count: createdSlots.length,
      slots: createdSlots.map(toDto),
    };
  });
}

module.exports = {
  createSlot,
  createRecurringSlots,
  findOverlappingSlot,
  toDto,
};
