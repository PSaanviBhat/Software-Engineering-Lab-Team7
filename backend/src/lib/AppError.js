class AppError extends Error {
  constructor(status, code, message, details = {}, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
    this.extra = extra;
  }
}

module.exports = AppError;
