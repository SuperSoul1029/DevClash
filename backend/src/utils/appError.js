class AppError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode || 500;
    this.details = details;
    this.isOperational = true;
  }
}

module.exports = AppError;
