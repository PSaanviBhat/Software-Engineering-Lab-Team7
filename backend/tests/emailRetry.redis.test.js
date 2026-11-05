// Runs the real queue and worker against Redis: your pts-redis container locally,
// the Redis service in CI. The mailer and the database are mocked.
process.env.ENABLE_QUEUE_IN_TESTS = "true";
process.env.EMAIL_MAX_ATTEMPTS = "4";
process.env.EMAIL_BACKOFF_MS = "50";

jest.mock("../src/lib/mailer", () => ({ sendMail: jest.fn() }));

const logRows = [];
jest.mock("../src/lib/prisma", () => ({
  booking: {
    findUnique: jest.fn().mockResolvedValue({
      id: "b1",
      status: "CONFIRMED",
      learner: { name: "Asha", email: "asha@test.local" },
      slot: {
        subject: "DBMS",
        mode: "ONLINE",
        link: "https://meet.example.com/x",
        startUtc: new Date(),
        tutor: { name: "Tutor 1", email: "tutor1@test.local" },
      },
    }),
  },
  emailLog: { create: jest.fn(async ({ data }) => logRows.push(data)) },
}));

const { sendMail } = require("../src/lib/mailer");
const { getEmailQueue } = require("../src/queues/emailQueue");
const { getConnection } = require("../src/lib/redis");
const { startEmailWorker } = require("../src/workers/emailWorker");

// Polls until the condition is true, so the test does not depend on fixed sleeps.
async function waitFor(condition, ms = 8000) {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error("timed out waiting for the email jobs");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const summary = () => logRows.map((r) => `${r.status}:${r.attempts}`);
let worker;

beforeEach(() => {
  logRows.length = 0;
  sendMail.mockReset();
  worker = startEmailWorker();
});
afterEach(() => worker.close());
afterAll(async () => {
  await getEmailQueue().close();
  await getConnection().quit();
});

test("TC-NOTIF-04: a mailer that always fails gets 3 retries, then a FAILED log", async () => {
  sendMail.mockRejectedValue(new Error("smtp down"));
  await getEmailQueue().add(
    "CONFIRMATION",
    { bookingId: "b1", type: "CONFIRMATION" },
    { jobId: `fail-${Date.now()}` }
  );
  await waitFor(() => logRows.length >= 4);
  expect(sendMail).toHaveBeenCalledTimes(4);
  expect(summary()).toEqual(["RETRYING:1", "RETRYING:2", "RETRYING:3", "FAILED:4"]);
});

test("a mailer that fails once then works is logged RETRYING, then SENT", async () => {
  sendMail.mockRejectedValueOnce(new Error("blip")).mockResolvedValue({});
  await getEmailQueue().add(
    "CONFIRMATION",
    { bookingId: "b1", type: "CONFIRMATION" },
    { jobId: `ok-${Date.now()}` }
  );
  await waitFor(() => logRows.length >= 2);
  expect(summary()).toEqual(["RETRYING:1", "SENT:2"]);
});