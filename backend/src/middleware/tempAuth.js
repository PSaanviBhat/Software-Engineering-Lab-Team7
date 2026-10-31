const auth = require("./auth");
const AppError = require("../lib/AppError");

// Legacy compatibility for booking tests and development callers. New protected
// routes must use the strict JWT middleware directly.
module.exports = function tempAuth(req, res, next) {
  const fallbackId = req.header("x-user-id");
  if (fallbackId) {
    req.user = { id: fallbackId, role: "LEARNER" };
    return next();
  }

  return auth(req, res, (error) => {
    if (error) return next(error);
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    next();
  });
};
