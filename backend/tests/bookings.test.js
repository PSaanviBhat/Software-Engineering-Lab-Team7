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
      verified: true,
    },
  });
  userIds.push(user.id);
  return user;
}

const tokenFor = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);

async function makeSlot(tutorId, startOffsetHours = 48, durationHours = 1, subject = "DBMS") {
  const startUtc = new Date(Date.now() + startOffsetHours * HOUR);
  const endUtc = new Date(startUtc.getTime() + durationHours * HOUR);
  return prisma.slot.create({
    data: { tutorId, subject, startUtc, endUtc, mode: "ONLINE" },
  });
}

const cancel = (user, bookingId) =>
  request(app).delete(`/api/bookings/${bookingId}`).set("Authorization", `Bearer ${tokenFor(user)}`);

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

describe("POST /api/bookings concurrency and overlap", () => {
  it("TC-BOOK-02: 10 simultaneous requests for one slot give exactly one 201 and nine 409 SLOT_TAKEN", async () => {
    const tutor = await makeUser("TUTOR");
    const learners = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
    const slot = await makeSlot(tutor.id);

    const results = await Promise.all(learners.map((l) => book(l, slot.id)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const losers = results.filter((r) => r.status === 409);
    expect(losers).toHaveLength(9);
    losers.forEach((r) => expect(r.body.error).toBe("SLOT_TAKEN"));
    const active = await prisma.booking.count({ where: { slotId: slot.id, status: "CONFIRMED" } });
    expect(active).toBe(1);
  });

  it("TC-BOOK-03: same learner, overlapping slots from different tutors gives 409 LEARNER_OVERLAP", async () => {
    const [tutorA, tutorB] = [await makeUser("TUTOR"), await makeUser("TUTOR")];
    const learner = await makeUser();
    const slotA = await makeSlot(tutorA.id, 48, 1);
    const slotB = await makeSlot(tutorB.id, 48.5, 1);

    const first = await book(learner, slotA.id);
    const second = await book(learner, slotB.id);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("LEARNER_OVERLAP");
    expect(second.body.clashingBookingId).toBe(first.body.bookingId);
    const stillFree = await prisma.slot.findUnique({ where: { id: slotB.id } });
    expect(stillFree.status).toBe("FREE");
  });

  it("allows back-to-back slots (one ends exactly when the next starts)", async () => {
    const [tutorA, tutorB] = [await makeUser("TUTOR"), await makeUser("TUTOR")];
    const learner = await makeUser();
    const slotA = await makeSlot(tutorA.id, 72, 1);
    const slotB = await makeSlot(tutorB.id, 73, 1);

    expect((await book(learner, slotA.id)).status).toBe(201);
    expect((await book(learner, slotB.id)).status).toBe(201);
  });

  it("ignores cancelled bookings when checking overlap", async () => {
    const [tutorA, tutorB] = [await makeUser("TUTOR"), await makeUser("TUTOR")];
    const learner = await makeUser();
    const slotA = await makeSlot(tutorA.id, 96, 1);
    const slotB = await makeSlot(tutorB.id, 96, 1);

    const first = await book(learner, slotA.id);
    await prisma.booking.update({ where: { id: first.body.bookingId }, data: { status: "CANCELLED" } });

    expect((await book(learner, slotB.id)).status).toBe(201);
  });

  it("one learner firing two overlapping requests at once gets one 201 and one LEARNER_OVERLAP", async () => {
    const [tutorA, tutorB] = [await makeUser("TUTOR"), await makeUser("TUTOR")];
    const learner = await makeUser();
    const slotA = await makeSlot(tutorA.id, 120, 1);
    const slotB = await makeSlot(tutorB.id, 120, 1);

    const results = await Promise.all([book(learner, slotA.id), book(learner, slotB.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409).body.error).toBe("LEARNER_OVERLAP");
  });

  it("database rejects a second CONFIRMED booking for the same slot (unique index backstop)", async () => {
    const tutor = await makeUser("TUTOR");
    const [first, second] = [await makeUser(), await makeUser()];
    const slot = await makeSlot(tutor.id);
    await prisma.booking.create({ data: { slotId: slot.id, learnerId: first.id } });

    await expect(
      prisma.booking.create({ data: { slotId: slot.id, learnerId: second.id } })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("DELETE /api/bookings/:id", () => {
  async function bookedIn(hours) {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser();
    const slot = await makeSlot(tutor.id, hours);
    const res = await book(learner, slot.id);
    return { tutor, learner, slot, bookingId: res.body.bookingId };
  }

  it("TC-BOOK-05: cancelling 3 h before start succeeds and frees the slot", async () => {
    const { learner, slot, bookingId } = await bookedIn(3);

    const res = await cancel(learner, bookingId);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
    expect((await prisma.slot.findUnique({ where: { id: slot.id } })).status).toBe("FREE");
    expect((await prisma.booking.findUnique({ where: { id: bookingId } })).status).toBe("CANCELLED");

    const another = await makeUser();
    expect((await book(another, slot.id)).status).toBe(201);
  });

  it("TC-BOOK-05: cancelling 1 h before start returns 409 TOO_LATE_TO_CANCEL", async () => {
    const { learner, slot, bookingId } = await bookedIn(1);

    const res = await cancel(learner, bookingId);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("TOO_LATE_TO_CANCEL");
    expect((await prisma.slot.findUnique({ where: { id: slot.id } })).status).toBe("BOOKED");
    expect((await prisma.booking.findUnique({ where: { id: bookingId } })).status).toBe("CONFIRMED");
  });

  it("TC-BOOK-05: another learner cancelling returns 403", async () => {
    const { bookingId } = await bookedIn(3);
    const stranger = await makeUser();

    const res = await cancel(stranger, bookingId);

    expect(res.status).toBe(403);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } })).status).toBe("CONFIRMED");
  });

  it("returns 404 for an unknown booking and 400 for a malformed id", async () => {
    const learner = await makeUser();
    expect((await cancel(learner, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await cancel(learner, "nope")).status).toBe(400);
  });

  it("returns 409 ALREADY_CANCELLED when cancelling twice", async () => {
    const { learner, bookingId } = await bookedIn(3);
    await cancel(learner, bookingId);

    const res = await cancel(learner, bookingId);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ALREADY_CANCELLED");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).delete("/api/bookings/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/bookings/me", () => {
  it("returns only my bookings, upcoming first", async () => {
    const tutor = await makeUser("TUTOR");
    const learner = await makeUser();
    const other = await makeUser();
    const later = await makeSlot(tutor.id, 100);
    const sooner = await makeSlot(tutor.id, 30);
    const notMine = await makeSlot(tutor.id, 10);
    await book(learner, later.id);
    await book(learner, sooner.id);
    await book(other, notMine.id);

    const res = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${tokenFor(learner)}`);

    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.slotId)).toEqual([sooner.id, later.id]);
    expect(res.body[0]).toMatchObject({ status: "CONFIRMED", subject: "DBMS", tutorId: tutor.id });
  });

  it("returns 401 without a token", async () => {
    expect((await request(app).get("/api/bookings/me")).status).toBe(401);
  });
});

describe("TC-BOOK-04: alternatives on a booking conflict (F-015)", () => {
  // Each test uses its own subject so slots from other tests or the seed never leak in.
  let subjectSeq = 0;
  const newSubject = () => `ALT-${run}-${subjectSeq++}`;

  async function takenSlot(subject, tutor, offsetHours = 48) {
    const slot = await makeSlot(tutor.id, offsetHours, 1, subject);
    const winner = await makeUser();
    expect((await book(winner, slot.id)).status).toBe(201);
    return slot;
  }

  it("returns up to 3 nearest free future slots of the same subject, none of them taken", async () => {
    const subject = newSubject();
    const tutor = await makeUser("TUTOR");
    const taken = await takenSlot(subject, tutor, 48);
    const near = await makeSlot((await makeUser("TUTOR")).id, 49, 1, subject);
    const mid = await makeSlot((await makeUser("TUTOR")).id, 51, 1, subject);
    const far = await makeSlot((await makeUser("TUTOR")).id, 60, 1, subject);
    await makeSlot((await makeUser("TUTOR")).id, 200, 1, subject);
    await makeSlot((await makeUser("TUTOR")).id, -5, 1, subject);
    const otherSubject = await makeSlot((await makeUser("TUTOR")).id, 48, 1, newSubject());
    const alsoBooked = await takenSlot(subject, await makeUser("TUTOR"), 50);
    const loser = await makeUser();

    const res = await book(loser, taken.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("SLOT_TAKEN");
    expect(res.body.alternatives).toHaveLength(3);
    expect(res.body.alternatives.map((a) => a.slotId)).toEqual([near.id, mid.id, far.id]);
    for (const alt of res.body.alternatives) {
      const row = await prisma.slot.findUnique({ where: { id: alt.slotId } });
      expect(row.status).toBe("FREE");
      expect(new Date(alt.start).getTime()).toBeGreaterThan(Date.now());
      expect(alt.subject).toBe(subject);
      expect([taken.id, alsoBooked.id, otherSubject.id]).not.toContain(alt.slotId);
    }
    expect(res.body.alternatives[0]).toEqual({
      slotId: near.id,
      tutorId: near.tutorId,
      tutorName: expect.any(String),
      subject,
      start: near.startUtc.toISOString(),
      end: near.endUtc.toISOString(),
      mode: "ONLINE",
    });
  });

  it("returns fewer than 3 when fewer exist, and an empty list when none exist", async () => {
    const subject = newSubject();
    const taken = await takenSlot(subject, await makeUser("TUTOR"));
    const loser = await makeUser();

    const none = await book(loser, taken.id);
    expect(none.status).toBe(409);
    expect(none.body.alternatives).toEqual([]);

    const only = await makeSlot((await makeUser("TUTOR")).id, 52, 1, subject);
    const one = await book(loser, taken.id);
    expect(one.body.alternatives.map((a) => a.slotId)).toEqual([only.id]);
  });

  it("puts the same tutor's slots first, even when another tutor's slot is nearer", async () => {
    const subject = newSubject();
    const tutor = await makeUser("TUTOR");
    const taken = await takenSlot(subject, tutor, 48);
    const sameTutorLater = await makeSlot(tutor.id, 150, 1, subject);
    const otherTutorNearer = await makeSlot((await makeUser("TUTOR")).id, 49, 1, subject);
    const loser = await makeUser();

    const res = await book(loser, taken.id);

    expect(res.body.alternatives.map((a) => a.slotId)).toEqual([
      sameTutorLater.id,
      otherTutorNearer.id,
    ]);
  });

  it("never suggests the learner's own slots or slots overlapping their confirmed bookings", async () => {
    const subject = newSubject();
    const taken = await takenSlot(subject, await makeUser("TUTOR"), 48);
    const loser = await makeUser("TUTOR");
    await makeSlot(loser.id, 49, 1, subject);
    const clashing = await makeSlot((await makeUser("TUTOR")).id, 70, 1, subject);
    const fine = await makeSlot((await makeUser("TUTOR")).id, 90, 1, subject);
    const existing = await makeSlot((await makeUser("TUTOR")).id, 70.5, 1, newSubject());
    expect((await book(loser, existing.id)).status).toBe(201);

    const res = await book(loser, taken.id);

    expect(res.status).toBe(409);
    expect(res.body.alternatives.map((a) => a.slotId)).toEqual([fine.id]);
    expect(res.body.alternatives.map((a) => a.slotId)).not.toContain(clashing.id);
  });

  it("also returns alternatives with LEARNER_OVERLAP", async () => {
    const subject = newSubject();
    const learner = await makeUser();
    const first = await makeSlot((await makeUser("TUTOR")).id, 48, 1, subject);
    const clashing = await makeSlot((await makeUser("TUTOR")).id, 48.5, 1, subject);
    const free = await makeSlot((await makeUser("TUTOR")).id, 80, 1, subject);
    expect((await book(learner, first.id)).status).toBe(201);

    const res = await book(learner, clashing.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("LEARNER_OVERLAP");
    expect(res.body.clashingBookingId).toEqual(expect.any(String));
    expect(res.body.alternatives.map((a) => a.slotId)).toEqual([free.id]);
  });

  it("does not add alternatives to a successful booking or to other errors", async () => {
    const tutor = await makeUser("TUTOR");
    const slot = await makeSlot(tutor.id, 48, 1, newSubject());

    const own = await book(tutor, slot.id);
    expect(own.status).toBe(403);
    expect(own.body).not.toHaveProperty("alternatives");

    const ok = await book(await makeUser(), slot.id);
    expect(ok.status).toBe(201);
    expect(ok.body).not.toHaveProperty("alternatives");
  });
});

