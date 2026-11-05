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
const { enqueueConfirmation } = require("../src/services/notificationService");
const { processEmail } = require("../src/workers/emailWorker");

const confirmed = {
  id: "b1",
  status: "CONFIRMED",
  learner: { name: "Asha", email: "asha@test.local" },
  slot: {
    subject: "DBMS",
    mode: "ONLINE",
    link: "https://meet.example.com/x",
    startUtc: new Date("2026-11-10T10:00:00Z"),
    tutor: { name: "Tutor 1", email: "tutor1@test.local" },
  },
};
const job = { data: { bookingId: "b1", type: "CONFIRMATION" }, attemptsMade: 0 };

describe("PTS-31 confirmation email", () => {
  beforeEach(() => jest.clearAllMocks());

  it("enqueues one confirmation job per booking", async () => {
    const add = jest.fn();
    getEmailQueue.mockReturnValue({ add });
    await enqueueConfirmation("b1");
    expect(add).toHaveBeenCalledWith(
      "CONFIRMATION",
      { bookingId: "b1", type: "CONFIRMATION" },
      { jobId: "confirmation-b1" }
    );
  });

  it("does not throw when the queue is down", async () => {
    getEmailQueue.mockReturnValue({ add: jest.fn().mockRejectedValue(new Error("redis down")) });
    await expect(enqueueConfirmation("b1")).resolves.toBeUndefined();
  });

    it("TC-NOTIF-01: sends one email to the learner and the tutor, and logs it", async () => {
    prisma.booking.findUnique.mockResolvedValue(confirmed);
    await processEmail(job);
    expect(sendMail).toHaveBeenCalledWith(
     expect.objectContaining({ to: ["asha@test.local", "tutor1@test.local"] })
   );    
    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: { bookingId: "b1", type: "CONFIRMATION", status: "SENT", attempts: 1 },
    });
  });

  it("sends nothing for a cancelled booking", async () => {
    prisma.booking.findUnique.mockResolvedValue({ ...confirmed, status: "CANCELLED" });
    const result = await processEmail(job);
    expect(result).toEqual({ skipped: "booking-not-confirmed" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});