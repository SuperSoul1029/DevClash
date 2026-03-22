const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const { getQueueHealth } = require("../services/jobQueue");

const getHealth = asyncHandler(async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const queue = getQueueHealth();

  res.json({
    success: true,
    status: dbReady ? "ok" : "degraded",
    checks: {
      database: {
        ready: dbReady,
        state: mongoose.connection.readyState
      },
      queue
    },
    uptimeSec: Math.round(process.uptime())
  });
});

module.exports = {
  getHealth
};