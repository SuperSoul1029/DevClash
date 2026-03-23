const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const VideoJob = require("../models/VideoJob");

const getJobStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { jobId } = req.params;

  const job = await VideoJob.findOne({ _id: jobId, userId }).lean();
  if (!job) {
    throw new AppError("Job not found", 404);
  }

  res.json({
    success: true,
    job: {
      jobId: job._id,
      type: "youtube.explain",
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error
    }
  });
});

module.exports = {
  getJobStatus
};