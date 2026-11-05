const { Worker } = require("bullmq");
const prisma = require("../lib/prisma");
const { getConnection } = require("../lib/redis");
const { EMAIL_QUEUE } = require("../queues/emailQueue");
const mailer = require("../lib/mailer");
const { buildEmail } = require("../services/emailTemplates");

// Handles one job. Throwing makes BullMQ retry it with the backoff set on the queue.
async function processEmail(job) {
  const { bookingId, type } = job.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { learner: true, slot: { include: { tutor: true } } },
  });

  // Skipped on cancel (PTS-32): a cancelled or deleted booking never gets an email,
  // except for SLOT_CANCELLED notifications notifying learners of tutor cancellations (PTS-26).
  if (!booking) return { skipped: "booking-not-found" };
  if (type !== "SLOT_CANCELLED" && booking.status !== "CONFIRMED") {
    return { skipped: "booking-not-confirmed" };
  }

  await mailer.sendMail(buildEmail(type, booking));

  await prisma.emailLog.create({
    data: { bookingId, type, status: "SENT", attempts: job.attemptsMade + 1 },
  });
  return { sent: true };
}

// Called after every failed attempt (SRS F-022, TC-NOTIF-04). RETRYING means another
// attempt is coming, FAILED means BullMQ has given up.
async function recordFailure(job, err) {
  const attempts = job.attemptsMade;
  const finalFailure = attempts >= (job.opts.attempts || 1);
  await prisma.emailLog.create({
    data: {
      bookingId: job.data.bookingId,
      type: job.data.type,
      status: finalFailure ? "FAILED" : "RETRYING",
      attempts,
    },
  });
  console.error(
    `email ${job.data.type} for booking ${job.data.bookingId} failed (attempt ${attempts}): ${err.message}`
  );
}

function startEmailWorker() {
  const worker = new Worker(EMAIL_QUEUE, processEmail, { connection: getConnection() });
  worker.on("failed", (job, err) => {
    if (!job) return;
    recordFailure(job, err).catch((e) => console.error("could not write EmailLog:", e.message));
  });
  worker.on("error", (err) => console.error("email worker error:", err.message));
  return worker;
}

module.exports = { processEmail, recordFailure, startEmailWorker };