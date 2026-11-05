const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

const TX_OPTIONS = { maxWait: 10000, timeout: 10000 };

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
    status: { not: "CANCELLED" },
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

async function updateSlot({ tutorId, slotId, subject, startUtc, endUtc, mode, link }) {
  const existing = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!existing || existing.status === "CANCELLED") {
    throw new AppError(404, "SLOT_NOT_FOUND", "Slot not found");
  }
  if (existing.tutorId !== tutorId) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to edit this slot");
  }
  if (existing.status === "BOOKED") {
    throw new AppError(409, "SLOT_BOOKED", "Cannot edit a booked slot");
  }
  if (existing.startUtc <= new Date()) {
    throw new AppError(400, "SLOT_IN_PAST", "Slot has already started");
  }

  const overlapping = await findOverlappingSlot({
    tutorId,
    startUtc,
    endUtc,
    excludeSlotId: slotId,
  });

  if (overlapping) {
    throw new AppError(
      409,
      "SLOT_OVERLAP",
      "You already have a slot that overlaps this time"
    );
  }

  const updated = await prisma.slot.update({
    where: { id: slotId },
    data: {
      subject,
      startUtc,
      endUtc,
      mode,
      link: mode === "ONLINE" ? link : null,
    },
  });

  return toDto(updated);
}

async function deleteSlot({ tutorId, slotId }) {
  return prisma.$transaction(async (tx) => {
    const slots = await tx.$queryRaw`SELECT * FROM "Slot" WHERE id = ${slotId} FOR UPDATE`;
    const slot = slots[0];
    if (!slot || slot.status === "CANCELLED") {
      throw new AppError(404, "SLOT_NOT_FOUND", "Slot not found");
    }
    if (slot.tutorId !== tutorId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to delete this slot");
    }

    if (slot.status === "FREE") {
      const bookingCount = await tx.booking.count({ where: { slotId } });
      if (bookingCount === 0) {
        await tx.slot.delete({ where: { id: slotId } });
      } else {
        await tx.slot.update({ where: { id: slotId }, data: { status: "CANCELLED" } });
      }
      return { cancelledBookingIds: [] };
    }

    // Slot is BOOKED:
    const bookings = await tx.booking.findMany({
      where: { slotId, status: "CONFIRMED" },
      select: { id: true },
    });

    await tx.booking.updateMany({
      where: { slotId, status: "CONFIRMED" },
      data: { status: "CANCELLED" },
    });

    await tx.slot.update({
      where: { id: slotId },
      data: { status: "CANCELLED" },
    });

    return {
      cancelledBookingIds: bookings.map((b) => b.id),
    };
  }, TX_OPTIONS);
}

module.exports = {
  createSlot,
  createRecurringSlots,
  findOverlappingSlot,
  updateSlot,
  deleteSlot,
  toDto,
};
