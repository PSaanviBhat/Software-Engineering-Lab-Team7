const { Queue } = require("bullmq");
const { getConnection } = require("../lib/redis");

const EMAIL_QUEUE = "email";

let queue;

function getEmailQueue() {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
    });
  }
  return queue;
}

module.exports = { EMAIL_QUEUE, getEmailQueue };