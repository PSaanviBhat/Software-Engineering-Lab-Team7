const { getEmailQueue } = require("../queues/emailQueue");

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

module.exports = { enqueueConfirmation };