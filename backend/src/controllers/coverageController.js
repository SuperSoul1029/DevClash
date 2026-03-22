const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const Topic = require("../models/Topic");
const TopicProgress = require("../models/TopicProgress");
const { applyCoverageSignal, computeCoverageStatus } = require("../utils/learningEngine");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");

async function ensureTopicExists(topicId) {
  const topic = await Topic.findById(topicId).select("_id");
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }
  return topic;
}

const syncCoverageActivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { topicId, signalType } = req.body;

  const topic = await ensureTopicExists(topicId);
  const existing = await TopicProgress.findOne({ userId, topicId: topic._id });

  const autoCoverageScore = applyCoverageSignal(existing, signalType);

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        autoCoverageScore
      }
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  res.status(201).json({
    success: true,
    coverage: {
      topicId: topic._id,
      signalType,
      autoCoverageScore: progress.autoCoverageScore,
      manualCoverage: progress.manualCoverage,
      effectiveCovered: computeCoverageStatus(progress.manualCoverage, progress.autoCoverageScore)
    }
  });
});

const manualMarkCovered = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { topicId } = req.body;

  const topic = await ensureTopicExists(topicId);

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        manualCoverage: "covered",
        manualCoverageUpdatedAt: new Date()
      }
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  res.json({
    success: true,
    coverage: {
      topicId: topic._id,
      autoCoverageScore: progress.autoCoverageScore,
      manualCoverage: progress.manualCoverage,
      effectiveCovered: true
    }
  });
});

const manualUnmarkTopic = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { topicId } = req.body;

  const topic = await ensureTopicExists(topicId);

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        manualCoverage: "uncovered",
        manualCoverageUpdatedAt: new Date()
      }
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  res.json({
    success: true,
    coverage: {
      topicId: topic._id,
      autoCoverageScore: progress.autoCoverageScore,
      manualCoverage: progress.manualCoverage,
      effectiveCovered: false
    }
  });
});

const manualResetTopic = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { topicId } = req.body;

  const topic = await ensureTopicExists(topicId);

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        manualCoverage: null,
        manualCoverageUpdatedAt: new Date()
      }
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  res.json({
    success: true,
    coverage: {
      topicId: topic._id,
      autoCoverageScore: progress.autoCoverageScore,
      manualCoverage: progress.manualCoverage,
      effectiveCovered: computeCoverageStatus(progress.manualCoverage, progress.autoCoverageScore)
    }
  });
});

const getCoverageState = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const topicFilter = {};

  if (req.query.subjectId) {
    topicFilter.subjectId = req.query.subjectId;
  }
  if (req.query.classLevel) {
    topicFilter.classLevel = req.query.classLevel;
  }

  const topics = await Topic.find(topicFilter)
    .populate("subjectId", "name code classLevel")
    .sort({ classLevel: 1, chapter: 1, name: 1 });

  const topicIds = topics.map((topic) => topic._id);

  const progressRows = await TopicProgress.find({
    userId: new mongoose.Types.ObjectId(userId),
    topicId: { $in: topicIds }
  });

  const progressByTopic = new Map(progressRows.map((row) => [String(row.topicId), row]));

  const state = topics.map((topic) => {
    const progress = progressByTopic.get(String(topic._id));
    const autoCoverageScore = progress?.autoCoverageScore ?? 0;
    const manualCoverage = progress?.manualCoverage ?? null;
    const practicedQuestions = progress?.practicedQuestions || 0;
    const practicedCorrect = progress?.practicedCorrect || 0;
    const practiceAccuracy = practicedQuestions > 0 ? practicedCorrect / practicedQuestions : 0;
    const cumulativeTestScore = progress?.cumulativeTestScore || 0;
    const cumulativeTestMaxScore = progress?.cumulativeTestMaxScore || 0;
    const averageTestPercentage =
      cumulativeTestMaxScore > 0 ? (cumulativeTestScore / cumulativeTestMaxScore) * 100 : 0;
    const effectiveCovered = computeCoverageStatus(manualCoverage, autoCoverageScore);

    return {
      topic: {
        _id: topic._id,
        name: topic.name,
        chapter: topic.chapter,
        classLevel: topic.classLevel,
        subject: topic.subjectId
      },
      autoCoverageScore,
      manualCoverage,
      effectiveCovered,
      confidence: Math.round(autoCoverageScore * 100),
      completionCount: progress?.completionCount || 0,
      retentionScore: progress?.retentionScore || 0,
      totalReviews: progress?.totalReviews || 0,
      practicedQuestions,
      practicedCorrect,
      practiceAccuracy: Number(practiceAccuracy.toFixed(3)),
      testsTaken: progress?.testsTaken || 0,
      cumulativeTestScore: Number(cumulativeTestScore.toFixed(2)),
      cumulativeTestMaxScore: Number(cumulativeTestMaxScore.toFixed(2)),
      averageTestPercentage: Number(averageTestPercentage.toFixed(2)),
      lastTestPercentage: progress?.lastTestPercentage ?? null
    };
  });

  const subjectSummaryMap = new Map();
  state.forEach((item) => {
    const subject = item.topic.subject;
    if (!subject?._id) {
      return;
    }

    const key = String(subject._id);
    if (!subjectSummaryMap.has(key)) {
      subjectSummaryMap.set(key, {
        subjectId: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        classLevel: subject.classLevel,
        totalTopics: 0,
        coveredTopics: 0,
        completionCount: 0,
        practicedQuestions: 0,
        practicedCorrect: 0,
        testsTaken: 0,
        cumulativeTestScore: 0,
        cumulativeTestMaxScore: 0
      });
    }

    const row = subjectSummaryMap.get(key);
    row.totalTopics += 1;
    row.coveredTopics += item.effectiveCovered ? 1 : 0;
    row.completionCount += item.completionCount || 0;
    row.practicedQuestions += item.practicedQuestions || 0;
    row.practicedCorrect += item.practicedCorrect || 0;
    row.testsTaken += item.testsTaken || 0;
    row.cumulativeTestScore += item.cumulativeTestScore || 0;
    row.cumulativeTestMaxScore += item.cumulativeTestMaxScore || 0;
  });

  const subjects = Array.from(subjectSummaryMap.values()).map((item) => {
    const practiceAccuracy =
      item.practicedQuestions > 0 ? item.practicedCorrect / item.practicedQuestions : 0;
    const averageTestPercentage =
      item.cumulativeTestMaxScore > 0 ? (item.cumulativeTestScore / item.cumulativeTestMaxScore) * 100 : 0;

    return {
      ...item,
      uncoveredTopics: Math.max(0, item.totalTopics - item.coveredTopics),
      practiceAccuracy: Number(practiceAccuracy.toFixed(3)),
      averageTestPercentage: Number(averageTestPercentage.toFixed(2)),
      cumulativeTestScore: Number(item.cumulativeTestScore.toFixed(2)),
      cumulativeTestMaxScore: Number(item.cumulativeTestMaxScore.toFixed(2))
    };
  });

  const coveredCount = state.filter((item) => item.effectiveCovered).length;

  res.json({
    success: true,
    coverage: {
      totalTopics: state.length,
      coveredTopics: coveredCount,
      uncoveredTopics: state.length - coveredCount
    },
    subjects,
    state
  });
});

module.exports = {
  syncCoverageActivity,
  manualMarkCovered,
  manualUnmarkTopic,
  manualResetTopic,
  getCoverageState
};
