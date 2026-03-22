const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const Topic = require("../models/Topic");
const TopicProgress = require("../models/TopicProgress");
const RevisionEvent = require("../models/RevisionEvent");
const { computeRetentionUpdate, computeCoverageStatus } = require("../utils/learningEngine");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");

const recordRetentionEvent = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const payload = req.body;

  const topic = await Topic.findById(payload.topicId).select("_id");
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  const event = await RevisionEvent.create({
    userId,
    topicId: topic._id,
    source: payload.source,
    outcome: payload.outcome,
    accuracy: payload.accuracy ?? null,
    confidence: payload.confidence ?? null,
    timeSpentSec: payload.timeSpentSec ?? 0,
    occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date()
  });

  const existing = await TopicProgress.findOne({ userId, topicId: topic._id });
  const update = computeRetentionUpdate(existing, event);

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        retentionScore: update.retentionScore,
        nextReviewAt: update.nextReviewAt,
        lastReviewedAt: update.lastReviewedAt,
        lastOutcome: update.lastOutcome,
        streak: update.streak,
        totalReviews: update.totalReviews,
        totalCorrect: update.totalCorrect,
        totalIncorrect: update.totalIncorrect,
        autoCoverageScore: update.autoCoverageScore
      },
      ...(payload.outcome === "completed" ? { $inc: { completionCount: 1 } } : {})
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  res.status(201).json({
    success: true,
    event,
    retention: {
      topicId: topic._id,
      retentionScore: progress.retentionScore,
      nextReviewAt: progress.nextReviewAt,
      streak: progress.streak,
      totalReviews: progress.totalReviews
    }
  });
});

const getRetentionState = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const filter = { userId: new mongoose.Types.ObjectId(userId) };

  if (req.query.topicId) {
    filter.topicId = new mongoose.Types.ObjectId(req.query.topicId);
  }

  const progress = await TopicProgress.find(filter)
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code" }
    })
    .sort({ updatedAt: -1 });

  const states = progress.map((row) => ({
    topicId: row.topicId?._id || row.topicId,
    topicName: row.topicId?.name || null,
    chapter: row.topicId?.chapter || null,
    subject: row.topicId?.subjectId
      ? {
          _id: row.topicId.subjectId._id,
          name: row.topicId.subjectId.name,
          code: row.topicId.subjectId.code
        }
      : null,
    retentionScore: row.retentionScore,
    nextReviewAt: row.nextReviewAt,
    lastReviewedAt: row.lastReviewedAt,
    streak: row.streak,
    totalReviews: row.totalReviews,
    coverage: {
      autoCoverageScore: row.autoCoverageScore,
      manualCoverage: row.manualCoverage,
      effectiveCovered: computeCoverageStatus(row.manualCoverage, row.autoCoverageScore)
    }
  }));

  const avgRetention =
    states.length > 0
      ? Math.round(states.reduce((sum, row) => sum + row.retentionScore, 0) / states.length)
      : 0;

  const weakTopics = states.filter((row) => row.retentionScore < 55).length;

  res.json({
    success: true,
    retention: {
      averageScore: avgRetention,
      weakTopics,
      totalTrackedTopics: states.length
    },
    states
  });
});

module.exports = {
  recordRetentionEvent,
  getRetentionState
};
