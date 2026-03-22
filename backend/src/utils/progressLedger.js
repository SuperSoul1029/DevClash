const Topic = require("../models/Topic");
const TopicProgress = require("../models/TopicProgress");
const SubjectProgress = require("../models/SubjectProgress");
const { computeCoverageStatus } = require("./learningEngine");

function safeObjectId(value) {
  return String(value || "");
}

async function syncSubjectLedger(userId, subjectId) {
  const subjectTopics = await Topic.find({ subjectId }).select("_id").lean();

  if (subjectTopics.length === 0) {
    await SubjectProgress.deleteOne({ userId, subjectId });
    return null;
  }

  const topicIds = subjectTopics.map((topic) => topic._id);
  const progressRows = await TopicProgress.find({ userId, topicId: { $in: topicIds } }).lean();

  const rowByTopic = new Map(progressRows.map((row) => [safeObjectId(row.topicId), row]));

  let coveredTopics = 0;
  let completionCount = 0;
  let practicedQuestions = 0;
  let practicedCorrect = 0;
  let testsTaken = 0;
  let cumulativeTestScore = 0;
  let cumulativeTestMaxScore = 0;

  topicIds.forEach((topicId) => {
    const row = rowByTopic.get(safeObjectId(topicId));
    if (!row) {
      return;
    }

    if (computeCoverageStatus(row.manualCoverage, row.autoCoverageScore || 0)) {
      coveredTopics += 1;
    }

    completionCount += row.completionCount || 0;
    practicedQuestions += row.practicedQuestions || 0;
    practicedCorrect += row.practicedCorrect || 0;
    testsTaken += row.testsTaken || 0;
    cumulativeTestScore += row.cumulativeTestScore || 0;
    cumulativeTestMaxScore += row.cumulativeTestMaxScore || 0;
  });

  const totalTopics = topicIds.length;
  const practiceAccuracy = practicedQuestions > 0 ? practicedCorrect / practicedQuestions : 0;
  const averageTestPercentage =
    cumulativeTestMaxScore > 0 ? (cumulativeTestScore / cumulativeTestMaxScore) * 100 : 0;

  const update = {
    totalTopics,
    coveredTopics,
    uncoveredTopics: Math.max(0, totalTopics - coveredTopics),
    completionCount,
    practicedQuestions,
    practicedCorrect,
    practiceAccuracy: Number(practiceAccuracy.toFixed(3)),
    testsTaken,
    cumulativeTestScore: Number(cumulativeTestScore.toFixed(2)),
    cumulativeTestMaxScore: Number(cumulativeTestMaxScore.toFixed(2)),
    averageTestPercentage: Number(averageTestPercentage.toFixed(2))
  };

  return SubjectProgress.findOneAndUpdate(
    { userId, subjectId },
    { $set: update },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );
}

async function syncSubjectLedgerByTopic(userId, topicId) {
  const topic = await Topic.findById(topicId).select("subjectId").lean();
  if (!topic || !topic.subjectId) {
    return null;
  }

  return syncSubjectLedger(userId, topic.subjectId);
}

module.exports = {
  syncSubjectLedger,
  syncSubjectLedgerByTopic
};
