const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const env = require("../config/env");
const { logInfo, logWarn, logError } = require("../utils/logger");

const handlers = new Map();

let queueMode = "in-memory";
let queueReady = false;
let redisConnection;
let youtubeQueue;
let youtubeWorker;

function ensureHandler(name) {
  const handler = handlers.get(name);
  if (!handler) {
    throw new Error(`No job handler registered for ${name}`);
  }

  return handler;
}

async function runInMemory(name, payload) {
  const handler = ensureHandler(name);

  setTimeout(async () => {
    try {
      await handler(payload);
    } catch (error) {
      logError("queue.in_memory.job_failed", {
        name,
        message: error.message
      });
    }
  }, 20);
}

async function runBullMq(payload) {
  await youtubeQueue.add("youtube.explain", payload, {
    removeOnComplete: 200,
    removeOnFail: 200,
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 1500
    }
  });
}

async function initializeQueues() {
  if (!env.redisUrl) {
    queueMode = "in-memory";
    queueReady = true;
    logWarn("queue.fallback.in_memory", {
      reason: "REDIS_URL not configured"
    });
    return;
  }

  try {
    redisConnection = new IORedis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      retryStrategy: () => null
    });

    redisConnection.on("error", () => {
      // Connection failures are handled by fallback logic below.
    });

    await redisConnection.connect();
    await redisConnection.ping();

    youtubeQueue = new Queue("youtube-explain", {
      connection: redisConnection
    });

    youtubeWorker = new Worker(
      "youtube-explain",
      async (job) => {
        const handler = ensureHandler(job.name);
        await handler(job.data);
      },
      {
        connection: redisConnection
      }
    );

    youtubeWorker.on("failed", (job, error) => {
      logError("queue.worker.failed", {
        queue: "youtube-explain",
        jobId: job?.id,
        message: error.message
      });
    });

    queueMode = "bullmq";
    queueReady = true;
    logInfo("queue.bullmq.ready", {
      queue: "youtube-explain"
    });
  } catch (error) {
    if (redisConnection) {
      try {
        await redisConnection.quit();
      } catch (_error) {
        redisConnection.disconnect();
      }
    }

    redisConnection = undefined;

    queueMode = "in-memory";
    queueReady = true;
    logWarn("queue.bullmq.unavailable", {
      message: error.message
    });
  }
}

function registerJobHandler(name, handler) {
  handlers.set(name, handler);
}

async function enqueueJob(name, payload) {
  if (!queueReady) {
    await initializeQueues();
  }

  if (queueMode === "bullmq") {
    await runBullMq(payload);
    return;
  }

  await runInMemory(name, payload);
}

function getQueueHealth() {
  return {
    mode: queueMode,
    ready: queueReady
  };
}

module.exports = {
  initializeQueues,
  registerJobHandler,
  enqueueJob,
  getQueueHealth
};