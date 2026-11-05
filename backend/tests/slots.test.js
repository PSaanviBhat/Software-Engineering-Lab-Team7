const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let seq = 0;
const userIds = [];
const originalJwtSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = originalJwtSecret || "test-only-jwt-secret";
});

async function makeUser(role = "LEARNER") {
  const user = await prisma.user.create({
    data: {
      name: `${role} ${run}`,
      email: `${role.toLowerCase()}-${run}-${seq++}@test.example.com`,
      passwordHash: "x",
      role,
    },
  });
  userIds.push(user.id);
  return user;
}

const tokenFor = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);

const postSlot = (token, body) => {
  const req = request(app).post("/api/slots");
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body);
};

const putSlot = (token, slotId, body) => {
  const req = request(app).put(`/api/slots/${slotId}`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body);
};

const deleteSlot = (token, slotId) => {
  const req = request(app).delete(`/api/slots/${slotId}`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

afterAll(async () => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;

  const tutorSlots = await prisma.slot.findMany({
    where: { tutorId: { in: userIds } },
    select: { id: true },
  });
  const slotIds = tutorSlots.map((s) => s.id);
  const bookings = await prisma.booking.findMany({
    where: { slotId: { in: slotIds } },
    select: { id: true },
  });
  const bIds = bookings.map((b) => b.id);
  if (bIds.length > 0) {
    await prisma.emailLog.deleteMany({ where: { bookingId: { in: bIds } } });
  }
  await prisma.booking.deleteMany({ where: { slotId: { in: slotIds } } });
  await prisma.slot.deleteMany({ where: { tutorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("POST /api/slots - Weekly recurring slots (TC-SLOT-02)", () => {
  it("TC-SLOT-02: repeatWeeks=4 creates exactly 4 slots, each 7 days after the previous, same subject/mode, response count 4", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const res = await postSlot(tokenFor(tutor), {
      subject: "Mathematics",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
      link: "https://meet.example.com/math",
      repeatWeeks: 4,
    });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(4);
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots).toHaveLength(4);

    for (let i = 0; i < 4; i++) {
      const slot = res.body.slots[i];
      expect(slot.subject).toBe("Mathematics");
      expect(slot.mode).toBe("ONLINE");
      expect(slot.link).toBe("https://meet.example.com/math");
      expect(slot.status).toBe("FREE");
      expect(slot.tutorId).toBe(tutor.id);

      const expectedStart = new Date(startUtc.getTime() + i * 7 * DAY).toISOString();
      const expectedEnd = new Date(endUtc.getTime() + i * 7 * DAY).toISOString();
      expect(slot.start).toBe(expectedStart);
      expect(slot.end).toBe(expectedEnd);
    }

    const dbSlots = await prisma.slot.findMany({
      where: { tutorId: tutor.id },
      orderBy: { startUtc: "asc" },
    });
    expect(dbSlots).toHaveLength(4);
  });

  it("TC-SLOT-02: repeatWeeks=8 creates 8", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 72 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const res = await postSlot(tokenFor(tutor), {
      subject: "Computer Science",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 8,
    });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(8);
    expect(res.body.slots).toHaveLength(8);

    const dbSlots = await prisma.slot.findMany({
      where: { tutorId: tutor.id },
    });
    expect(dbSlots).toHaveLength(8);
  });

  it("TC-SLOT-02: repeatWeeks=9, 0, -1, 2.5 -> 400 INVALID_INPUT", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const invalidWeeks = [9, 0, -1, 2.5];

    for (const repeatWeeks of invalidWeeks) {
      const res = await postSlot(tokenFor(tutor), {
        subject: "Physics",
        start: startUtc.toISOString(),
        end: endUtc.toISOString(),
        mode: "ONLINE",
        repeatWeeks,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_INPUT");
    }
  });

  it("TC-SLOT-02: repeatWeeks omitted still returns 201 with a single slot DTO (no regression)", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const res = await postSlot(tokenFor(tutor), {
      subject: "Chemistry",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "IN_PERSON",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.tutorId).toBe(tutor.id);
    expect(res.body.subject).toBe("Chemistry");
    expect(res.body.start).toBe(startUtc.toISOString());
    expect(res.body.end).toBe(endUtc.toISOString());
    expect(res.body.mode).toBe("IN_PERSON");
    expect(res.body.status).toBe("FREE");
    expect(res.body.count).toBeUndefined();
    expect(res.body.slots).toBeUndefined();
  });

  it("TC-SLOT-02: one instance overlaps an existing slot (e.g. week 3) -> 409 SLOT_OVERLAP, details list that start time, and NO slots from the series were created", async () => {
    const tutor = await makeUser("TUTOR");
    const baseStart = new Date(Date.now() + 48 * HOUR);
    const baseEnd = new Date(baseStart.getTime() + 1 * HOUR);

    // Create an existing slot that coincides with week 3 (index 2: baseStart + 14 days)
    const week3Start = new Date(baseStart.getTime() + 2 * 7 * DAY);
    const week3End = new Date(baseEnd.getTime() + 2 * 7 * DAY);

    const existingSlot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Existing Pre-booked Slot",
        startUtc: week3Start,
        endUtc: week3End,
        mode: "ONLINE",
      },
    });

    // Attempt to create a 4-week series starting at baseStart
    const res = await postSlot(tokenFor(tutor), {
      subject: "Recurring Series",
      start: baseStart.toISOString(),
      end: baseEnd.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 4,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("SLOT_OVERLAP");

    const conflicts = res.body.details?.conflicts || res.body.details?.conflictingStarts;
    expect(conflicts).toBeDefined();
    expect(conflicts).toContain(week3Start.toISOString());

    // Verify all-or-nothing: NO slots from the recurring series were created
    const tutorSlots = await prisma.slot.findMany({
      where: { tutorId: tutor.id },
    });
    expect(tutorSlots).toHaveLength(1);
    expect(tutorSlots[0].id).toBe(existingSlot.id);
  });

  it("TC-SLOT-02: recurring slots with back-to-back times are allowed", async () => {
    const tutor = await makeUser("TUTOR");
    const start1 = new Date(Date.now() + 48 * HOUR);
    const end1 = new Date(start1.getTime() + 1 * HOUR);

    // Series 1: 10:00 - 11:00 for 2 weeks
    const res1 = await postSlot(tokenFor(tutor), {
      subject: "Math Back-to-Back 1",
      start: start1.toISOString(),
      end: end1.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 2,
    });
    expect(res1.status).toBe(201);
    expect(res1.body.count).toBe(2);

    // Series 2: 11:00 - 12:00 for 2 weeks (starts exactly when Series 1 ends)
    const start2 = end1;
    const end2 = new Date(start2.getTime() + 1 * HOUR);
    const res2 = await postSlot(tokenFor(tutor), {
      subject: "Math Back-to-Back 2",
      start: start2.toISOString(),
      end: end2.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 2,
    });
    expect(res2.status).toBe(201);
    expect(res2.body.count).toBe(2);

    const totalSlots = await prisma.slot.findMany({
      where: { tutorId: tutor.id },
    });
    expect(totalSlots).toHaveLength(4);
  });

  it("TC-SLOT-02: learner role -> 403, no token -> 401", async () => {
    const learner = await makeUser("LEARNER");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const payload = {
      subject: "Biology",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 2,
    };

    // Learner token
    const resLearner = await postSlot(tokenFor(learner), payload);
    expect(resLearner.status).toBe(403);
    expect(resLearner.body.error).toBe("FORBIDDEN");

    // No token
    const resNoToken = await postSlot(null, payload);
    expect(resNoToken.status).toBe(401);
    expect(resNoToken.body.error).toBe("UNAUTHORIZED");
  });

  it("TC-SLOT-02: single slot overlap throws 409 SLOT_OVERLAP", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const res1 = await postSlot(tokenFor(tutor), {
      subject: "Art",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
    });
    expect(res1.status).toBe(201);

    const res2 = await postSlot(tokenFor(tutor), {
      subject: "Art",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
    });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe("SLOT_OVERLAP");
  });

  it("TC-SLOT-02: end time before start time returns 400 INVALID_TIME_RANGE", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() - 1 * HOUR);

    const res = await postSlot(tokenFor(tutor), {
      subject: "Music",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 3,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_TIME_RANGE");
  });

  it("TC-SLOT-02: start time in past returns 400 SLOT_IN_PAST", async () => {
    const tutor = await makeUser("TUTOR");
    const startUtc = new Date(Date.now() - 24 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const res = await postSlot(tokenFor(tutor), {
      subject: "History",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
      repeatWeeks: 2,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SLOT_IN_PAST");
  });

  it("TC-SLOT-02: findOverlappingSlot helper correctly excludes a slot by ID (reusable for edit)", async () => {
    const tutor = await makeUser("TUTOR");
    const { findOverlappingSlot } = require("../src/services/slotService");
    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Geography",
        startUtc,
        endUtc,
        mode: "ONLINE",
      },
    });

    // Excluded slot ID should not be found as overlapping
    const overlapWithExclude = await findOverlappingSlot({
      tutorId: tutor.id,
      startUtc,
      endUtc,
      excludeSlotId: slot.id,
    });
    expect(overlapWithExclude).toBeNull();

    // Without exclusion, it should be found
    const overlapWithoutExclude = await findOverlappingSlot({
      tutorId: tutor.id,
      startUtc,
      endUtc,
    });
    expect(overlapWithoutExclude).not.toBeNull();
    expect(overlapWithoutExclude.id).toBe(slot.id);
  });
});

describe("PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04)", () => {
  const notificationService = require("../src/services/notificationService");
  const { processEmail } = require("../src/workers/emailWorker");
  const mailer = require("../src/lib/mailer");

  let enqueueSlotCancelledSpy;
  let cancelRemindersSpy;

  beforeEach(() => {
    enqueueSlotCancelledSpy = jest.spyOn(notificationService, "enqueueSlotCancelled");
    cancelRemindersSpy = jest.spyOn(notificationService, "cancelReminders");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("TC-SLOT-04: delete a booked slot -> 204, booking CANCELLED, slot not listed, enqueueSlotCancelled called once per learner", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser("LEARNER");

    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Algorithms",
        startUtc,
        endUtc,
        mode: "ONLINE",
        status: "BOOKED",
      },
    });

    const booking = await prisma.booking.create({
      data: {
        slotId: slot.id,
        learnerId: learner.id,
        status: "CONFIRMED",
      },
    });

    const res = await deleteSlot(tokenFor(tutor), slot.id);
    expect(res.status).toBe(204);

    // Booking status becomes CANCELLED
    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("CANCELLED");

    // Slot status becomes CANCELLED
    const updatedSlot = await prisma.slot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot.status).toBe("CANCELLED");

    // Slot is not listed in GET /api/slots
    const listRes = await request(app)
      .get("/api/slots")
      .set("Authorization", `Bearer ${tokenFor(learner)}`);
    expect(listRes.status).toBe(200);
    const listedIds = listRes.body.map((s) => s.id);
    expect(listedIds).not.toContain(slot.id);

    // Notifications called
    expect(cancelRemindersSpy).toHaveBeenCalledWith(booking.id);
    expect(enqueueSlotCancelledSpy).toHaveBeenCalledWith(booking.id);
  });

  it("TC-SLOT-04: edit own free slot succeeds; edit that overlaps another slot of the tutor -> 409 SLOT_OVERLAP; edit to its own time succeeds", async () => {
    const tutor = await makeUser("TUTOR");

    const start1 = new Date(Date.now() + 48 * HOUR);
    const end1 = new Date(start1.getTime() + 1 * HOUR);
    const slotA = await prisma.slot.create({
      data: { tutorId: tutor.id, subject: "Physics", startUtc: start1, endUtc: end1, mode: "ONLINE" },
    });

    const start2 = new Date(Date.now() + 50 * HOUR);
    const end2 = new Date(start2.getTime() + 1 * HOUR);
    await prisma.slot.create({
      data: { tutorId: tutor.id, subject: "Math", startUtc: start2, endUtc: end2, mode: "ONLINE" },
    });

    // Edit slot A to a new free time (52h-53h) -> succeeds
    const newStart = new Date(Date.now() + 52 * HOUR);
    const newEnd = new Date(newStart.getTime() + 1 * HOUR);
    const resEdit = await putSlot(tokenFor(tutor), slotA.id, {
      subject: "Advanced Physics",
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
      mode: "IN_PERSON",
    });
    expect(resEdit.status).toBe(200);
    expect(resEdit.body.subject).toBe("Advanced Physics");
    expect(resEdit.body.mode).toBe("IN_PERSON");
    expect(resEdit.body.start).toBe(newStart.toISOString());
    expect(resEdit.body.end).toBe(newEnd.toISOString());

    // Edit slot A to overlap slot B (50h-51h) -> 409 SLOT_OVERLAP
    const resOverlap = await putSlot(tokenFor(tutor), slotA.id, {
      subject: "Advanced Physics",
      start: start2.toISOString(),
      end: end2.toISOString(),
      mode: "ONLINE",
    });
    expect(resOverlap.status).toBe(409);
    expect(resOverlap.body.error).toBe("SLOT_OVERLAP");

    // Edit slot A to its own current time -> succeeds
    const resOwnTime = await putSlot(tokenFor(tutor), slotA.id, {
      subject: "Advanced Physics Updated",
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
      mode: "ONLINE",
    });
    expect(resOwnTime.status).toBe(200);
    expect(resOwnTime.body.subject).toBe("Advanced Physics Updated");
  });

  it("TC-SLOT-04: edit a BOOKED slot -> 409 SLOT_BOOKED; delete a FREE slot -> 204", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser("LEARNER");

    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    // Booked slot cannot be edited
    const bookedSlot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Chemistry",
        startUtc,
        endUtc,
        mode: "ONLINE",
        status: "BOOKED",
      },
    });
    await prisma.booking.create({
      data: { slotId: bookedSlot.id, learnerId: learner.id, status: "CONFIRMED" },
    });

    const resEditBooked = await putSlot(tokenFor(tutor), bookedSlot.id, {
      subject: "Chemistry 101",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
    });
    expect(resEditBooked.status).toBe(409);
    expect(resEditBooked.body.error).toBe("SLOT_BOOKED");

    // Free slot can be deleted with 204
    const freeSlot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Biology",
        startUtc: new Date(Date.now() + 72 * HOUR),
        endUtc: new Date(Date.now() + 73 * HOUR),
        mode: "ONLINE",
      },
    });

    const resDeleteFree = await deleteSlot(tokenFor(tutor), freeSlot.id);
    expect(resDeleteFree.status).toBe(204);

    const deletedFromDb = await prisma.slot.findUnique({ where: { id: freeSlot.id } });
    expect(deletedFromDb).toBeNull();
  });

  it("TC-SLOT-04: another tutor edits or deletes -> 403 FORBIDDEN; learner role -> 403; no token -> 401; unknown id -> 404 SLOT_NOT_FOUND; bad uuid -> 400", async () => {
    const tutor1 = await makeUser("TUTOR");
    const tutor2 = await makeUser("TUTOR");
    const learner = await makeUser("LEARNER");

    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);
    const slot = await prisma.slot.create({
      data: { tutorId: tutor1.id, subject: "History", startUtc, endUtc, mode: "ONLINE" },
    });

    const editBody = {
      subject: "World History",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
    };

    // Another tutor
    const resOtherEdit = await putSlot(tokenFor(tutor2), slot.id, editBody);
    expect(resOtherEdit.status).toBe(403);
    expect(resOtherEdit.body.error).toBe("FORBIDDEN");

    const resOtherDelete = await deleteSlot(tokenFor(tutor2), slot.id);
    expect(resOtherDelete.status).toBe(403);
    expect(resOtherDelete.body.error).toBe("FORBIDDEN");

    // Learner role
    const resLearnerEdit = await putSlot(tokenFor(learner), slot.id, editBody);
    expect(resLearnerEdit.status).toBe(403);
    expect(resLearnerEdit.body.error).toBe("FORBIDDEN");

    const resLearnerDelete = await deleteSlot(tokenFor(learner), slot.id);
    expect(resLearnerDelete.status).toBe(403);
    expect(resLearnerDelete.body.error).toBe("FORBIDDEN");

    // No token
    const resNoTokenEdit = await putSlot(null, slot.id, editBody);
    expect(resNoTokenEdit.status).toBe(401);
    expect(resNoTokenEdit.body.error).toBe("UNAUTHORIZED");

    const resNoTokenDelete = await deleteSlot(null, slot.id);
    expect(resNoTokenDelete.status).toBe(401);
    expect(resNoTokenDelete.body.error).toBe("UNAUTHORIZED");

    // Unknown id
    const unknownId = "00000000-0000-4000-8000-000000000000";
    const resUnknownEdit = await putSlot(tokenFor(tutor1), unknownId, editBody);
    expect(resUnknownEdit.status).toBe(404);
    expect(resUnknownEdit.body.error).toBe("SLOT_NOT_FOUND");

    const resUnknownDelete = await deleteSlot(tokenFor(tutor1), unknownId);
    expect(resUnknownDelete.status).toBe(404);
    expect(resUnknownDelete.body.error).toBe("SLOT_NOT_FOUND");

    // Bad uuid
    const resBadUuidEdit = await putSlot(tokenFor(tutor1), "not-a-uuid", editBody);
    expect(resBadUuidEdit.status).toBe(400);
    expect(resBadUuidEdit.body.error).toBe("INVALID_INPUT");

    const resBadUuidDelete = await deleteSlot(tokenFor(tutor1), "not-a-uuid");
    expect(resBadUuidDelete.status).toBe(400);
    expect(resBadUuidDelete.body.error).toBe("INVALID_INPUT");
  });

  it("TC-SLOT-04: end <= start -> 400 INVALID_TIME_RANGE; past start -> 400 SLOT_IN_PAST", async () => {
    const tutor = await makeUser("TUTOR");

    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);
    const slot = await prisma.slot.create({
      data: { tutorId: tutor.id, subject: "Logic", startUtc, endUtc, mode: "ONLINE" },
    });

    // End <= start
    const resEndBeforeStart = await putSlot(tokenFor(tutor), slot.id, {
      subject: "Logic",
      start: startUtc.toISOString(),
      end: new Date(startUtc.getTime() - 1 * HOUR).toISOString(),
      mode: "ONLINE",
    });
    expect(resEndBeforeStart.status).toBe(400);
    expect(resEndBeforeStart.body.error).toBe("INVALID_TIME_RANGE");

    // Start in past
    const resPastStart = await putSlot(tokenFor(tutor), slot.id, {
      subject: "Logic",
      start: new Date(Date.now() - 2 * HOUR).toISOString(),
      end: new Date(Date.now() - 1 * HOUR).toISOString(),
      mode: "ONLINE",
    });
    expect(resPastStart.status).toBe(400);
    expect(resPastStart.body.error).toBe("SLOT_IN_PAST");
  });

  it("TC-SLOT-04: a deleted slot no longer blocks creating a slot at the same time, and cannot be booked", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser("LEARNER");

    const startUtc = new Date(Date.now() + 48 * HOUR);
    const endUtc = new Date(startUtc.getTime() + 1 * HOUR);

    // Create a booked slot and soft-delete it
    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Databases",
        startUtc,
        endUtc,
        mode: "ONLINE",
        status: "BOOKED",
      },
    });
    await prisma.booking.create({
      data: { slotId: slot.id, learnerId: learner.id, status: "CONFIRMED" },
    });

    const resDel = await deleteSlot(tokenFor(tutor), slot.id);
    expect(resDel.status).toBe(204);

    // Recreating at the exact same time succeeds (deleted slot does not block it)
    const resNewSlot = await postSlot(tokenFor(tutor), {
      subject: "New Databases Slot",
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      mode: "ONLINE",
    });
    expect(resNewSlot.status).toBe(201);

    // Booking the deleted slot is rejected
    const bookRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenFor(learner)}`)
      .send({ slotId: slot.id });
    expect(bookRes.status).toBeGreaterThanOrEqual(400);
  });

  it("TC-SLOT-04: worker: SLOT_CANCELLED is sent for a CANCELLED booking; CONFIRMATION is still skipped for a CANCELLED booking", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser("LEARNER");

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: "Networking",
        startUtc: new Date(Date.now() + 48 * HOUR),
        endUtc: new Date(Date.now() + 49 * HOUR),
        mode: "ONLINE",
        status: "CANCELLED",
      },
    });

    const booking = await prisma.booking.create({
      data: {
        slotId: slot.id,
        learnerId: learner.id,
        status: "CANCELLED",
      },
    });

    const sendMailSpy = jest.spyOn(mailer, "sendMail").mockResolvedValue({});

    // 1) SLOT_CANCELLED job for cancelled booking -> must be sent
    const jobCancel = {
      data: { bookingId: booking.id, type: "SLOT_CANCELLED" },
      attemptsMade: 0,
      opts: { attempts: 4 },
    };
    const resCancel = await processEmail(jobCancel);
    expect(resCancel).toEqual({ sent: true });
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    // Verify emailLog created
    const log = await prisma.emailLog.findFirst({
      where: { bookingId: booking.id, type: "SLOT_CANCELLED" },
    });
    expect(log).not.toBeNull();
    expect(log.status).toBe("SENT");

    // 2) CONFIRMATION job for cancelled booking -> must be skipped
    sendMailSpy.mockClear();
    const jobConfirm = {
      data: { bookingId: booking.id, type: "CONFIRMATION" },
      attemptsMade: 0,
      opts: { attempts: 4 },
    };
    const resConfirm = await processEmail(jobConfirm);
    expect(resConfirm).toEqual({ skipped: "booking-not-confirmed" });
    expect(sendMailSpy).not.toHaveBeenCalled();
  });
});
