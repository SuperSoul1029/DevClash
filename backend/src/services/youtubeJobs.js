const VideoJob = require("../models/VideoJob");
const { generateYoutubeExplanation } = require("../utils/youtubeEngine");
const { registerJobHandler } = require("./jobQueue");
const { logInfo, logWarn, logError } = require("../utils/logger");

async function processYoutubeExplainJob(payload) {
  const { jobId } = payload;

  const started = await VideoJob.findByIdAndUpdate(
    jobId,
    {
      status: "processing",
      progress: 15,
      startedAt: new Date(),
      error: null
    },
    { returnDocument: "after" }
  );

  if (!started) {
    logWarn("youtube.job.not_found", { jobId });
    return;
  }

  try {
    await VideoJob.findByIdAndUpdate(jobId, { progress: 50 });

    const result = generateYoutubeExplanation(started.sourceUrl);

    await VideoJob.findByIdAndUpdate(jobId, {
      status: "completed",
      progress: 100,
      result,
      completedAt: new Date()
    });

    logInfo("youtube.job.completed", {
      jobId,
      fallbackUsed: Boolean(result.fallbackUsed)
    });
  } catch (error) {
    await VideoJob.findByIdAndUpdate(jobId, {
      status: "failed",
      progress: 100,
      error: error.message,
      completedAt: new Date()
    });

    logError("youtube.job.failed", {
      jobId,
      message: error.message
    });
  }
}

function registerYoutubeProcessors() {
  registerJobHandler("youtube.explain", processYoutubeExplainJob);
}

module.exports = {
  registerYoutubeProcessors
};