const AppError = require("../lib/AppError");

/**
 * Enforces role-based access control (SR-003 / TC-SEC-03).
 * @param {...string} allowedRoles - E.g. "TUTOR", "ADMIN", "LEARNER"
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(403, "FORBIDDEN", "You do not have permission to perform this action")
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
};
