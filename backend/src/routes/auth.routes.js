const express = require("express");
const { register } = require("../services/auth.service");

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
