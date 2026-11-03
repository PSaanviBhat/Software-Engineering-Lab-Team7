const { Worker } = require("bullmq");
const prisma = require("../lib/prisma");
const { getConnection } = require("../lib/redis");
const { EMAIL_QUEUE } = require("../queues/emailQueue");
const { sendMail } = require("../lib/mailer");
const { buildEmail } = require("../services/emailTemplates");

// Handles one job. Throwing makes BullMQ retry it (PTS-33 sets how often).
async function processEmail(job) {
  const { bookingId, type } = job.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { learner: true, slot: { include: { tutor: true } } },
  });

  // Skipped on cancel (PTS-32): a cancelled or deleted booking never gets an email.
  if (!booking) return { skipped: "booking-not-found" };
  if (booking.status !== "CONFIRMED") return { skipped: "booking-not-confirmed" };

  await sendMail(buildEmail(type, booking));

  await prisma.emailLog.create({
    data: { bookingId, type, status: "SENT", attempts: job.attemptsMade + 1 },
  });
  return { sent: true };
}

function startEmailWorker() {
  const worker = new Worker(EMAIL_QUEUE, processEmail, { connection: getConnection() });
  worker.on("failed", (job, err) => console.error("email job failed:", err.message));
  worker.on("error", (err) => console.error("email worker error:", err.message));
  return worker;
}

module.exports = { processEmail, startEmailWorker };