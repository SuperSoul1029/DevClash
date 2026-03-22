const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const VideoJob = require("../models/VideoJob");
const { enqueueJob } = require("../services/jobQueue");

function serializeVideoJob(job) {
  return {
    jobId: job._id,
    status: job.status,
    progress: job.progress,
    sourceUrl: job.sourceUrl,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    result: job.status === "completed" ? job.result : null
  };
}

const startYoutubeExplain = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { url } = req.body;

  const job = await VideoJob.create({
    userId,
    sourceUrl: url,
    status: "queued",
    progress: 0
  });

  await enqueueJob("youtube.explain", {
    jobId: String(job._id),
    userId: String(userId),
    sourceUrl: url
  });

  res.status(202).json({
    success: true,
    job: serializeVideoJob(job)
  });
});

const getYoutubeExplainJob = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { jobId } = req.params;

  const job = await VideoJob.findOne({ _id: jobId, userId });
  if (!job) {
    throw new AppError("YouTube explain job not found", 404);
  }

  res.json({
    success: true,
    job: serializeVideoJob(job)
  });
});

module.exports = {
  startYoutubeExplain,
  getYoutubeExplainJob
};