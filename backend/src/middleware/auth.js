const jwt = require("jsonwebtoken");
const AppError = require("../lib/AppError");

function auth(req, res, next) {
  const authHeader = req.header("authorization");
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return next(new AppError(401, "UNAUTHORIZED", "Missing authentication token"));
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
  }
}

module.exports = auth;
