const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const { getQueueHealth } = require("../services/jobQueue");
const { getGatewaySummary } = require("../services/llmGateway");

const getHealth = asyncHandler(async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const queue = getQueueHealth();
  const gateway = getGatewaySummary();

  res.json({
    success: true,
    status: dbReady ? "ok" : "degraded",
    checks: {
      database: {
        ready: dbReady,
        state: mongoose.connection.readyState
      },
      queue,
      llmGateway: {
        configured: gateway.configured,
        contractCount: gateway.contracts.length,
        maxAttempts: gateway.maxAttempts,
        repairEnabled: gateway.repairEnabled,
        allowDeprecatedContracts: gateway.allowDeprecatedContracts,
        routing: gateway.routing
      }
    },
    llmGateway: {
      contracts: gateway.contracts,
      deprecatedContracts: gateway.deprecatedContracts
    },
    uptimeSec: Math.round(process.uptime())
  });
});

module.exports = {
  getHealth
};