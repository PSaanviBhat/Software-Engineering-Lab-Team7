// TEMP until PTS-14 (JWT auth) is merged
const AppError = require("../lib/AppError");

module.exports = function tempAuth(req, res, next) {
  const id = req.header("x-user-id");
  if (!id) return next(new AppError(401, "UNAUTHORIZED", "Missing x-user-id header"));
  req.user = { id };
  next();
};
