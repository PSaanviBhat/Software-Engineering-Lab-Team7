const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bookingsRouter = require("./routes/bookings");
const authRouter = require("./routes/auth");
const slotsRouter = require("./routes/slots");

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/slots", slotsRouter);

app.use((req, res) =>
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found", details: {} })
);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.code || "INTERNAL_ERROR",
    message: err.message || "Something went wrong",
    details: err.details || {},
    ...err.extra,
  });
});

module.exports = app;
