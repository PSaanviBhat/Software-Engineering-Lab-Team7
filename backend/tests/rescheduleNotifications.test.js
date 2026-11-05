// Checks that the reschedule route drives the notification service correctly.
// Everything the route depends on is mocked, so this needs no database and no Redis.
process.env.JWT_SECRET = "test_only_secret";

jest.mock("../src/lib/prisma", () => ({}));
jest.mock("../src/services/bookingService", () => ({
  rescheduleBooking: jest.fn(),
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

const OLD_BOOKING_ID = "8b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const NEW_BOOKING_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NEW_SLOT_ID = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const token = jwt.sign({ id: "learner-1", role: "LEARNER" }, process.env.JWT_SECRET);
const patch = (id, body) =>
  request(app).patch(`/api/bookings/${id}`).set("Authorization", `Bearer ${token}`).send(body);

describe("PATCH /api/bookings/:id and notifications", () => {
  beforeEach(() => jest.clearAllMocks());

  it("TC-BOOK-06: rescheduling skips the old reminders and confirms the new booking", async () => {
    bookingService.rescheduleBooking.mockResolvedValue({
      bookingId: NEW_BOOKING_ID,
      oldBookingId: OLD_BOOKING_ID,
      slotId: NEW_SLOT_ID,
      start: "2026-11-12T10:00:00.000Z",
      end: "2026-11-12T11:00:00.000Z",
      status: "CONFIRMED",
    });

    const res = await patch(OLD_BOOKING_ID, { newSlotId: NEW_SLOT_ID });

    expect(res.status).toBe(200);
    expect(bookingService.rescheduleBooking).toHaveBeenCalledWith({
      learnerId: "learner-1",
      bookingId: OLD_BOOKING_ID,
      newSlotId: NEW_SLOT_ID,
    });
    expect(notifications.cancelReminders).toHaveBeenCalledWith(OLD_BOOKING_ID);
    expect(notifications.enqueueConfirmation).toHaveBeenCalledWith(NEW_BOOKING_ID);
    expect(notifications.scheduleReminders).toHaveBeenCalledWith(
      NEW_BOOKING_ID,
      "2026-11-12T10:00:00.000Z"
    );
  });

  it("queues and cancels nothing when the reschedule is rejected", async () => {
    bookingService.rescheduleBooking.mockRejectedValue(
      new AppError(409, "SLOT_TAKEN", "Slot is already booked")
    );

    const res = await patch(OLD_BOOKING_ID, { newSlotId: NEW_SLOT_ID });

    expect(res.status).toBe(409);
    expect(notifications.cancelReminders).not.toHaveBeenCalled();
    expect(notifications.enqueueConfirmation).not.toHaveBeenCalled();
    expect(notifications.scheduleReminders).not.toHaveBeenCalled();
  });

  it("rejects a body without newSlotId", async () => {
    const res = await patch(OLD_BOOKING_ID, {});

    expect(res.status).toBe(400);
    expect(bookingService.rescheduleBooking).not.toHaveBeenCalled();
  });
});
