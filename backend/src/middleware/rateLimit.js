const AppError = require("../lib/AppError");
const { getConnection } = require("../lib/redis");

const memoryBuckets = new Map();

function secondsRemaining(expiresAt) {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

function memoryBucket(key, windowMs) {
  const current = memoryBuckets.get(key);
  if (!current || current.expiresAt <= Date.now()) {
    const fresh = { count: 0, expiresAt: Date.now() + windowMs };
    memoryBuckets.set(key, fresh);
    return fresh;
  }
  return current;
}

function shouldUseMemory() {
  return process.env.NODE_ENV === "test" || process.env.RATE_LIMIT_STORE === "memory";
}

function rateLimitError(retryAfterSeconds) {
  return new AppError(
    429,
    "RATE_LIMITED",
    "Too many requests. Try again later.",
    { retryAfterSeconds }
  );
}

function createRateLimiter({ name, windowMs, max }) {
  const redisWindowSeconds = Math.ceil(windowMs / 1000);

  async function readRedis(key) {
    const redis = getConnection();
    const [count, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
    return {
      count: Number(count || 0),
      expiresAt: Date.now() + Math.max(1, Number(ttl || redisWindowSeconds)) * 1000,
    };
  }

  async function incrementRedis(key) {
    const redis = getConnection();
    const result = await redis.multi().incr(key).expire(key, redisWindowSeconds).exec();
    return { count: Number(result[0][1]), expiresAt: Date.now() + redisWindowSeconds * 1000 };
  }

  async function read(key) {
    if (shouldUseMemory()) return memoryBucket(`${name}:${key}`, windowMs);
    try {
      return await readRedis(`${name}:${key}`);
    } catch {
      return memoryBucket(`${name}:${key}`, windowMs);
    }
  }

  async function increment(key) {
    if (shouldUseMemory()) {
      const bucket = memoryBucket(`${name}:${key}`, windowMs);
      bucket.count += 1;
      return bucket;
    }
    try {
      return await incrementRedis(`${name}:${key}`);
    } catch {
      const bucket = memoryBucket(`${name}:${key}`, windowMs);
      bucket.count += 1;
      return bucket;
    }
  }

  return {
    async isBlocked(key) {
      const bucket = await read(key);
      return {
        allowed: bucket.count < max,
        count: bucket.count,
        retryAfterSeconds: secondsRemaining(bucket.expiresAt),
      };
    },
    async consume(key) {
      const bucket = await increment(key);
      return {
        allowed: bucket.count <= max,
        count: bucket.count,
        retryAfterSeconds: secondsRemaining(bucket.expiresAt),
      };
    },
    clearMemory() {
      for (const key of memoryBuckets.keys()) {
        if (key.startsWith(`${name}:`)) memoryBuckets.delete(key);
      }
    },
  };
}

function middleware(limiter, keyGenerator) {
  return async (req, res, next) => {
    const result = await limiter.consume(keyGenerator(req));
    if (!result.allowed) {
      res.set("Retry-After", String(result.retryAfterSeconds));
      return next(rateLimitError(result.retryAfterSeconds));
    }
    next();
  };
}

const loginLimiter = createRateLimiter({ name: "login", windowMs: 15 * 60 * 1000, max: 5 });
const bookingLimiter = createRateLimiter({ name: "booking", windowMs: 60 * 60 * 1000, max: 20 });

module.exports = { bookingLimiter, loginLimiter, middleware, rateLimitError };
