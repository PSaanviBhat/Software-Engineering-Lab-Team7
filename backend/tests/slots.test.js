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

afterAll(async () => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  await prisma.booking.deleteMany({ where: { slot: { tutorId: { in: userIds } } } });
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
