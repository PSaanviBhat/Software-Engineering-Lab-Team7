const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const HOUR = 60 * 60 * 1000;
const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let seq = 0;
const userIds = [];

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

async function makeSlot(tutorId, startOffsetHours = 48, durationHours = 1) {
  const startUtc = new Date(Date.now() + startOffsetHours * HOUR);
  const endUtc = new Date(startUtc.getTime() + durationHours * HOUR);
  return prisma.slot.create({
    data: { tutorId, subject: "DBMS", startUtc, endUtc, mode: "ONLINE" },
  });
}

const book = (learnerId, slotId) =>
  request(app).post("/api/bookings").set("x-user-id", learnerId).send({ slotId });

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { learnerId: { in: userIds } } });
  await prisma.slot.deleteMany({ where: { tutorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("POST /api/bookings", () => {
  it("TC-BOOK-01: booking a free slot returns 201 and the slot becomes BOOKED", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser();
    const slot = await makeSlot(tutor.id);

    const res = await book(learner.id, slot.id);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      bookingId: expect.any(String),
      slotId: slot.id,
      start: slot.startUtc.toISOString(),
      end: slot.endUtc.toISOString(),
      status: "CONFIRMED",
    });
    const updated = await prisma.slot.findUnique({ where: { id: slot.id } });
    expect(updated.status).toBe("BOOKED");
  });

  it("TC-BOOK-07: a tutor booking their own slot returns 403 OWN_SLOT", async () => {
    const tutor = await makeUser("TUTOR");
    const slot = await makeSlot(tutor.id);

    const res = await book(tutor.id, slot.id);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("OWN_SLOT");
  });

  it("returns 404 for an unknown slot", async () => {
    const learner = await makeUser();
    const res = await book(learner.id, "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid input", async () => {
    const learner = await makeUser();
    const res = await book(learner.id, "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a slot in the past", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser();
    const slot = await makeSlot(tutor.id, -5);

    const res = await book(learner.id, slot.id);

    expect(res.status).toBe(400);
  });

  it("returns 409 SLOT_TAKEN when the slot is already booked", async () => {
    const tutor = await makeUser("TUTOR");
    const [first, second] = [await makeUser(), await makeUser()];
    const slot = await makeSlot(tutor.id);

    await book(first.id, slot.id);
    const res = await book(second.id, slot.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("SLOT_TAKEN");
  });

  it("returns 401 without x-user-id", async () => {
    const res = await request(app).post("/api/bookings").send({ slotId: "x" });
    expect(res.status).toBe(401);
  });
});
