const express = require("express");
const authService = require("../services/authService");
const auth = require("../middleware/auth");
const { loginLimiter, rateLimitError } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  const key = req.ip;
  const status = await loginLimiter.isBlocked(key);
  if (!status.allowed) {
    res.set("Retry-After", String(status.retryAfterSeconds));
    return next(rateLimitError(status.retryAfterSeconds));
  }

  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      const failure = await loginLimiter.consume(key);
      if (!failure.allowed) {
        res.set("Retry-After", String(failure.retryAfterSeconds));
        return next(rateLimitError(failure.retryAfterSeconds));
      }
    }
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/verify-email", async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body?.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/verify-email", async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.query.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/tutor-profile", auth, async (req, res, next) => {
  try {
    const result = await authService.updateTutorProfile(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/me", auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
