const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const AppError = require("../utils/appError");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Missing or invalid authorization token", 401));
  }

  const token = header.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub).select("_id email role fullName");

    if (!user) {
      return next(new AppError("User not found for token", 401));
    }

    req.user = user;
    return next();
  } catch (_error) {
    return next(new AppError("Invalid or expired token", 401));
  }
}

module.exports = {
  requireAuth
};
