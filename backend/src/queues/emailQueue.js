const { Queue } = require("bullmq");
const { getConnection } = require("../lib/redis");

const EMAIL_QUEUE = "email";

// SRS F-022: retry a failed email up to 3 times with exponential backoff.
// 1 first try + 3 retries = 4 attempts, waiting 2 s, 4 s, 8 s between them.
const MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS || 4);
const BACKOFF_MS = Number(process.env.EMAIL_BACKOFF_MS || 2000);

let queue;

function getEmailQueue() {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return queue;
}

module.exports = { EMAIL_QUEUE, getEmailQueue };