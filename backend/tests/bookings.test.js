const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

const HOUR = 60 * 60 * 1000;
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

async function makeSlot(tutorId, startOffsetHours = 48, durationHours = 1) {
  const startUtc = new Date(Date.now() + startOffsetHours * HOUR);
  const endUtc = new Date(startUtc.getTime() + durationHours * HOUR);
  return prisma.slot.create({
    data: { tutorId, subject: "DBMS", startUtc, endUtc, mode: "ONLINE" },
  });
}

const book = (user, slotId) =>
  request(app).post("/api/bookings").set("Authorization", `Bearer ${tokenFor(user)}`).send({ slotId });

afterAll(async () => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
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

    const res = await book(learner, slot.id);

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

    const res = await book(tutor, slot.id);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("OWN_SLOT");
  });

  it("returns 404 for an unknown slot", async () => {
    const learner = await makeUser();
    const res = await book(learner, "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid input", async () => {
    const learner = await makeUser();
    const res = await book(learner, "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a slot in the past", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser();
    const slot = await makeSlot(tutor.id, -5);

    const res = await book(learner, slot.id);

    expect(res.status).toBe(400);
  });

  it("returns 409 SLOT_TAKEN when the slot is already booked", async () => {
    const tutor = await makeUser("TUTOR");
    const [first, second] = [await makeUser(), await makeUser()];
    const slot = await makeSlot(tutor.id);

    await book(first, slot.id);
    const res = await book(second, slot.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("SLOT_TAKEN");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/bookings").send({ slotId: "x" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token and ignores the old x-user-id header", async () => {
    const learner = await makeUser();
    const bad = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer not-a-jwt")
      .send({ slotId: "x" });
    const legacy = await request(app)
      .post("/api/bookings")
      .set("x-user-id", learner.id)
      .send({ slotId: "x" });
    expect(bad.status).toBe(401);
    expect(legacy.status).toBe(401);
  });

  it("lets a tutor book another tutor's slot", async () => {
    const owner = await makeUser("TUTOR");
    const otherTutor = await makeUser("TUTOR");
    const slot = await makeSlot(owner.id);

    const res = await book(otherTutor, slot.id);

    expect(res.status).toBe(201);
  });
});
