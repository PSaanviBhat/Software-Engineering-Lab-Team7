const express = require("express");
const authService = require("../services/authService");
const { register } = require("../services/auth.service");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
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
