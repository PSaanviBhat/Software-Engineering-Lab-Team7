// Checks that the booking routes call the notification service at the right moment.
// Everything the routes depend on is mocked, so this needs no database and no Redis.
process.env.JWT_SECRET = "test_only_secret";

jest.mock("../src/lib/prisma", () => ({}));
jest.mock("../src/services/bookingService", () => ({
  createBooking: jest.fn(),
  cancelBooking: jest.fn(),
  listMyBookings: jest.fn(),
}));
jest.mock("../src/services/notificationService", () => ({
  enqueueConfirmation: jest.fn(),
  scheduleReminders: jest.fn(),
  cancelReminders: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const AppError = require("../src/lib/AppError");
const bookingService = require("../src/services/bookingService");
const notifications = require("../src/services/notificationService");

const SLOT_ID = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const BOOKING_ID = "8b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const token = jwt.sign({ id: "learner-1", role: "LEARNER" }, process.env.JWT_SECRET);
const authed = (req) => req.set("Authorization", `Bearer ${token}`);

describe("booking routes and notifications", () => {
  beforeEach(() => jest.clearAllMocks());

  it("TC-NOTIF-01: a new booking queues the confirmation and both reminders", async () => {
    bookingService.createBooking.mockResolvedValue({
      bookingId: BOOKING_ID,
      slotId: SLOT_ID,
      start: "2026-11-10T10:00:00.000Z",
      end: "2026-11-10T11:00:00.000Z",
      status: "CONFIRMED",
    });

    const res = await authed(request(app).post("/api/bookings")).send({ slotId: SLOT_ID });

    expect(res.status).toBe(201);
    expect(notifications.enqueueConfirmation).toHaveBeenCalledWith(BOOKING_ID);
    expect(notifications.scheduleReminders).toHaveBeenCalledWith(
      BOOKING_ID,
      "2026-11-10T10:00:00.000Z"
    );
  });

  it("queues nothing when the booking is rejected", async () => {
    bookingService.createBooking.mockRejectedValue(
      new AppError(409, "SLOT_TAKEN", "Slot is already booked")
    );

    const res = await authed(request(app).post("/api/bookings")).send({ slotId: SLOT_ID });

    expect(res.status).toBe(409);
    expect(notifications.enqueueConfirmation).not.toHaveBeenCalled();
    expect(notifications.scheduleReminders).not.toHaveBeenCalled();
  });

  it("TC-NOTIF-03: cancelling a booking removes its reminders", async () => {
    bookingService.cancelBooking.mockResolvedValue({
      ok: true,
      bookingId: BOOKING_ID,
      slotId: SLOT_ID,
      status: "CANCELLED",
    });

    const res = await authed(request(app).delete(`/api/bookings/${BOOKING_ID}`));

    expect(res.status).toBe(200);
    expect(notifications.cancelReminders).toHaveBeenCalledWith(BOOKING_ID);
  });

  it("keeps the reminders when the cancel is refused", async () => {
    bookingService.cancelBooking.mockRejectedValue(
      new AppError(409, "TOO_LATE_TO_CANCEL", "Too late")
    );

    const res = await authed(request(app).delete(`/api/bookings/${BOOKING_ID}`));

    expect(res.status).toBe(409);
    expect(notifications.cancelReminders).not.toHaveBeenCalled();
  });
});