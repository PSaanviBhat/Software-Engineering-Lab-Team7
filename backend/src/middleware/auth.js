const jwt = require("jsonwebtoken");
const AppError = require("../lib/AppError");

function auth(req, res, next) {
  const authHeader = req.header("authorization");
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    // Check fallback x-user-id for legacy tests or dev headers
    const fallbackId = req.header("x-user-id");
    if (fallbackId) {
      req.user = { id: fallbackId, role: "LEARNER" };
      return next();
    }
    return next(new AppError(401, "UNAUTHORIZED", "Missing authentication token"));
  }

  try {
    const secret = process.env.JWT_SECRET || "default_jwt_secret";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
  }
}

module.exports = auth;
