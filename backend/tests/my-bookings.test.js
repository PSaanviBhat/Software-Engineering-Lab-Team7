const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

jest.mock("../src/lib/prisma", () => ({
  booking: { findMany: jest.fn() },
}));

describe("GET /api/bookings/me - TC-CAL-03 (F-011)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-only-jwt-secret";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the authenticated learner's confirmed bookings in calendar-ready form", async () => {
    const start = new Date("2026-11-05T10:00:00.000Z");
    const end = new Date("2026-11-05T11:00:00.000Z");
    prisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        status: "CONFIRMED",
        slot: {
          id: "slot-1",
          subject: "DBMS",
          mode: "ONLINE",
          link: "https://meet.example.com/dbms",
          startUtc: start,
          endUtc: end,
          tutor: { id: "tutor-1", name: "Tutor One" },
        },
      },
    ]);

    const token = jwt.sign(
      { id: "learner-1", email: "learner@example.edu", role: "LEARNER" },
      process.env.JWT_SECRET
    );
    const res = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bookings: [
        {
          bookingId: "booking-1",
          slotId: "slot-1",
          subject: "DBMS",
          mode: "ONLINE",
          link: "https://meet.example.com/dbms",
          tutor: { id: "tutor-1", name: "Tutor One" },
          start: "2026-11-05T10:00:00.000Z",
          end: "2026-11-05T11:00:00.000Z",
          status: "CONFIRMED",
        },
      ],
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { learnerId: "learner-1", status: "CONFIRMED" },
      orderBy: { slot: { startUtc: "asc" } },
      include: {
        slot: { include: { tutor: { select: { id: true, name: true } } } },
      },
    });
  });

  it("requires a JWT", async () => {
    const res = await request(app).get("/api/bookings/me");
    expect(res.status).toBe(401);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
