const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again shortly"
  }
});

module.exports = apiRateLimiter;