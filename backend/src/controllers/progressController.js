const asyncHandler = require("../utils/asyncHandler");
const PlannerTask = require("../models/PlannerTask");
const TopicProgress = require("../models/TopicProgress");
const SubjectProgress = require("../models/SubjectProgress");
const Topic = require("../models/Topic");
const { toStartOfDay, computeCoverageStatus } = require("../utils/learningEngine");

const getProgressOverview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const today = toStartOfDay(new Date());

  const [progressRows, overdueTasks, dueTodayTasks] = await Promise.all([
    TopicProgress.find({ userId }),
    PlannerTask.countDocuments({ userId, status: "todo", dueDate: { $lt: today } }),
    PlannerTask.countDocuments({
      userId,
      status: "todo",
      dueDate: { $gte: today, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) }
    })
  ]);

  const retentionScore =
    progressRows.length > 0
      ? Math.round(progressRows.reduce((sum, row) => sum + row.retentionScore, 0) / progressRows.length)
      : 0;

  const weakTopics = progressRows.filter((row) => row.retentionScore < 55).length;
  const coveredTopics = progressRows.filter((row) =>
    computeCoverageStatus(row.manualCoverage, row.autoCoverageScore)
  ).length;
  const totalPracticedQuestions = progressRows.reduce((sum, row) => sum + (row.practicedQuestions || 0), 0);
  const totalPracticedCorrect = progressRows.reduce((sum, row) => sum + (row.practicedCorrect || 0), 0);
  const totalTestScore = progressRows.reduce((sum, row) => sum + (row.cumulativeTestScore || 0), 0);
  const totalTestMaxScore = progressRows.reduce((sum, row) => sum + (row.cumulativeTestMaxScore || 0), 0);
  const totalCompletions = progressRows.reduce((sum, row) => sum + (row.completionCount || 0), 0);

  res.json({
    success: true,
    overview: {
      retentionScore,
      weakTopics,
      overdueTasks,
      dueTodayTasks,
      coveredTopics,
      totalTrackedTopics: progressRows.length,
      completionCount: totalCompletions,
      practicedQuestions: totalPracticedQuestions,
      practiceAccuracy:
        totalPracticedQuestions > 0 ? Number((totalPracticedCorrect / totalPracticedQuestions).toFixed(3)) : 0,
      averageTestPercentage:
        totalTestMaxScore > 0 ? Number(((totalTestScore / totalTestMaxScore) * 100).toFixed(2)) : 0
    }
  });
});

const getProgressLedger = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const topics = await Topic.find({})
    .populate("subjectId", "name code classLevel")
    .sort({ classLevel: 1, chapter: 1, name: 1 })
    .lean();

  const progressRows = await TopicProgress.find({ userId }).lean();
  const subjectRows = await SubjectProgress.find({ userId })
    .populate("subjectId", "name code classLevel")
    .lean();

  const progressByTopic = new Map(progressRows.map((row) => [String(row.topicId), row]));

  const topicLedger = topics.map((topic) => {
    const row = progressByTopic.get(String(topic._id));
    const practicedQuestions = row?.practicedQuestions || 0;
    const practicedCorrect = row?.practicedCorrect || 0;
    const practiceAccuracy = practicedQuestions > 0 ? practicedCorrect / practicedQuestions : 0;
    const cumulativeTestScore = row?.cumulativeTestScore || 0;
    const cumulativeTestMaxScore = row?.cumulativeTestMaxScore || 0;
    const averageTestPercentage =
      cumulativeTestMaxScore > 0 ? (cumulativeTestScore / cumulativeTestMaxScore) * 100 : 0;
    const effectiveCovered = computeCoverageStatus(row?.manualCoverage || null, row?.autoCoverageScore || 0);

    return {
      topicId: topic._id,
      topicName: topic.name,
      chapter: topic.chapter,
      classLevel: topic.classLevel,
      subject: topic.subjectId,
      covered: effectiveCovered,
      autoCoverageScore: row?.autoCoverageScore || 0,
      manualCoverage: row?.manualCoverage || null,
      completionCount: row?.completionCount || 0,
      retentionScore: row?.retentionScore || 0,
      totalReviews: row?.totalReviews || 0,
      practicedQuestions,
      practicedCorrect,
      practiceAccuracy: Number(practiceAccuracy.toFixed(3)),
      testsTaken: row?.testsTaken || 0,
      cumulativeTestScore: Number(cumulativeTestScore.toFixed(2)),
      cumulativeTestMaxScore: Number(cumulativeTestMaxScore.toFixed(2)),
      averageTestPercentage: Number(averageTestPercentage.toFixed(2)),
      lastTestPercentage: row?.lastTestPercentage ?? null,
      nextReviewAt: row?.nextReviewAt || null
    };
  });

  const subjectLedger = subjectRows
    .filter((row) => row.subjectId)
    .map((row) => ({
      subjectId: row.subjectId._id,
      subjectName: row.subjectId.name,
      subjectCode: row.subjectId.code,
      classLevel: row.subjectId.classLevel,
      totalTopics: row.totalTopics,
      coveredTopics: row.coveredTopics,
      uncoveredTopics: row.uncoveredTopics,
      completionCount: row.completionCount,
      practicedQuestions: row.practicedQuestions,
      practicedCorrect: row.practicedCorrect,
      practiceAccuracy: row.practiceAccuracy,
      testsTaken: row.testsTaken,
      cumulativeTestScore: row.cumulativeTestScore,
      cumulativeTestMaxScore: row.cumulativeTestMaxScore,
      averageTestPercentage: row.averageTestPercentage
    }));

  res.json({
    success: true,
    ledger: {
      topics: topicLedger,
      subjects: subjectLedger
    }
  });
});

module.exports = {
  getProgressOverview,
  getProgressLedger
};
