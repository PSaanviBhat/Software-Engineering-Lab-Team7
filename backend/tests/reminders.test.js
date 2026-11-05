process.env.ENABLE_QUEUE_IN_TESTS = "true";

jest.mock("../src/queues/emailQueue", () => ({
  EMAIL_QUEUE: "email",
  getEmailQueue: jest.fn(),
}));
jest.mock("../src/lib/mailer", () => ({ sendMail: jest.fn() }));
jest.mock("../src/lib/prisma", () => ({
  booking: { findUnique: jest.fn() },
  emailLog: { create: jest.fn() },
}));

const { getEmailQueue } = require("../src/queues/emailQueue");
const { sendMail } = require("../src/lib/mailer");
const prisma = require("../src/lib/prisma");
const { scheduleReminders, cancelReminders } = require("../src/services/notificationService");
const { processEmail } = require("../src/workers/emailWorker");

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-04T06:00:00Z").getTime();
const hoursFromNow = (h) => new Date(NOW + h * HOUR);

describe("PTS-32 reminders", () => {
  let add;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    add = jest.fn();
    getEmailQueue.mockReturnValue({ add, getJob: jest.fn() });
  });

  afterEach(() => jest.restoreAllMocks());

  it("TC-NOTIF-02: a slot 2 days ahead gets two delayed jobs, at T-24h and T-1h", async () => {
    await scheduleReminders("b1", hoursFromNow(48));
    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith(
      "REMINDER_24H",
      { bookingId: "b1", type: "REMINDER_24H" },
      { jobId: "reminder_24h-b1", delay: 24 * HOUR }
    );
    expect(add).toHaveBeenCalledWith(
      "REMINDER_1H",
      { bookingId: "b1", type: "REMINDER_1H" },
      { jobId: "reminder_1h-b1", delay: 47 * HOUR }
    );
  });

  it("skips a reminder whose time has already passed", async () => {
    await scheduleReminders("b1", hoursFromNow(5));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe("REMINDER_1H");
  });

  it("schedules nothing for a slot starting in 30 minutes", async () => {
    await scheduleReminders("b1", hoursFromNow(0.5));
    expect(add).not.toHaveBeenCalled();
  });

  it("does not throw when the queue is down", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    getEmailQueue.mockReturnValue({ add: jest.fn().mockRejectedValue(new Error("redis down")) });
    await expect(scheduleReminders("b1", hoursFromNow(48))).resolves.toBeUndefined();
  });

  it("TC-NOTIF-03: cancelling removes both pending reminders", async () => {
    const remove = jest.fn();
    const getJob = jest.fn().mockResolvedValue({ remove });
    getEmailQueue.mockReturnValue({ add, getJob });
    await cancelReminders("b1");
    expect(getJob).toHaveBeenCalledWith("reminder_24h-b1");
    expect(getJob).toHaveBeenCalledWith("reminder_1h-b1");
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("TC-NOTIF-03: sends no reminder if the booking was cancelled before the job ran", async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: "b1", status: "CANCELLED" });
    const job = { data: { bookingId: "b1", type: "REMINDER_24H" }, attemptsMade: 0 };
    const result = await processEmail(job);
    expect(result).toEqual({ skipped: "booking-not-confirmed" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});