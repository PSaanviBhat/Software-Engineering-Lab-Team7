const IORedis = require("ioredis");

let connection;

// Created on first use, so importing this file never opens a connection (tests stay clean).
// BullMQ needs maxRetriesPerRequest: null on connections that workers use.
function getConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

module.exports = { getConnection };