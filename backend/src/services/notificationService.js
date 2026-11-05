const { getEmailQueue } = require("../queues/emailQueue");
const { sendMail } = require("../lib/mailer");
const { buildVerificationEmail } = require("./emailTemplates");

const HOUR = 60 * 60 * 1000;

const REMINDERS = [
  { type: "REMINDER_24H", beforeMs: 24 * HOUR },
  { type: "REMINDER_1H", beforeMs: 1 * HOUR },
];

const reminderJobId = (type, bookingId) => `${type.toLowerCase()}-${bookingId}`;

// Under Jest, skip the queue unless a test asks for it, so no Redis connection is left open.
function queueEnabled() {
  return process.env.NODE_ENV !== "test" || process.env.ENABLE_QUEUE_IN_TESTS === "true";
}

// Call AFTER the booking transaction has committed. Never throws: a failed email
// must not undo or fail a booking.
async function enqueueConfirmation(bookingId) {
  if (!queueEnabled()) return;
  try {
    await getEmailQueue().add(
      "CONFIRMATION",
      { bookingId, type: "CONFIRMATION" },
      { jobId: `confirmation-${bookingId}` }
    );
  } catch (err) {
    console.error("enqueueConfirmation failed:", err.message);
  }
}

// Schedules the 24 h and 1 h reminders as delayed jobs (SRS F-020, TC-NOTIF-02).
// A reminder whose time has already passed (a slot booked 3 hours ahead has no 24 h
// reminder) is skipped.
async function scheduleReminders(bookingId, slotStartUtc) {
  if (!queueEnabled()) return;
  try {
    const queue = getEmailQueue();
    const start = new Date(slotStartUtc).getTime();
    for (const { type, beforeMs } of REMINDERS) {
      const delay = start - beforeMs - Date.now();
      if (delay <= 0) continue;
      await queue.add(type, { bookingId, type }, { jobId: reminderJobId(type, bookingId), delay });
    }
  } catch (err) {
    console.error("scheduleReminders failed:", err.message);
  }
}

// Removes the pending reminders of a booking (cancel, or the old booking on a reschedule).
// A job that is already running cannot be removed, but the worker skips it because
// the booking is no longer CONFIRMED (SRS F-021, TC-NOTIF-03).
async function cancelReminders(bookingId) {
  if (!queueEnabled()) return;
  try {
    const queue = getEmailQueue();
    for (const { type } of REMINDERS) {
      const job = await queue.getJob(reminderJobId(type, bookingId));
      if (job) await job.remove();
    }
  } catch (err) {
    console.error("cancelReminders failed:", err.message);
  }
}

// Enqueues an email notifying the learner that their booked slot was cancelled by the tutor (PTS-26).
// Never throws: a failed queue call must not fail slot deletion.
async function enqueueSlotCancelled(bookingId) {
  if (!queueEnabled()) return;
  try {
    await getEmailQueue().add(
      "SLOT_CANCELLED",
      { bookingId, type: "SLOT_CANCELLED" },
      { jobId: `slot-cancelled-${bookingId}` }
    );
  } catch (err) {
    console.error("enqueueSlotCancelled failed:", err.message);
  }
}

// Sends the "verify your email" link right after registration (SRS F-002, TC-AUTH-02).
// `token` is the raw token; only its hash is stored in the database. Never throws:
// a failed email must not make registration fail.
async function sendVerificationEmail(user, token) {
  if (!queueEnabled()) return;
  try {
    const base = process.env.FRONTEND_URL || "http://localhost:3000";
    const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
    await sendMail(buildVerificationEmail(user, link));
  } catch (err) {
    console.error("sendVerificationEmail failed:", err.message);
  }
}

module.exports = {
  enqueueConfirmation,
  scheduleReminders,
  cancelReminders,
  enqueueSlotCancelled,
  sendVerificationEmail,
  REMINDERS,
};