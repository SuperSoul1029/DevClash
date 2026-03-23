const { randomUUID } = require("crypto");

function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}

module.exports = requestContext;