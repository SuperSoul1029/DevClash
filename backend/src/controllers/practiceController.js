const asyncHandler = require("../utils/asyncHandler");
const { z } = require("zod");
const ExamAttempt = require("../models/ExamAttempt");
const TopicProgress = require("../models/TopicProgress");
const Topic = require("../models/Topic");
const AppError = require("../utils/appError");
const { computeRetentionUpdate, applyCoverageSignal } = require("../utils/learningEngine");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");
const { getStructuredLlmOutput, isLlmConfigured } = require("../utils/llmClient");
const { logWarn } = require("../utils/logger");

const aiPracticeSetSchema = z.object({
  questions: z.array(
    z.object({
      topicId: z.string().min(1),
      type: z.enum(["mcq", "trueFalse"]),
      prompt: z.string().min(10).max(320),
      options: z.array(z.string().min(1).max(180)).min(2).max(4),
      whyAssigned: z.string().min(8).max(220)
    })
  )
});

function createQuestionId(index) {
  return `p-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeWeaknessByAttempts(attempts) {
  const weakness = new Map();

  attempts.forEach((attempt) => {
    const topicRows = attempt?.result?.topicBreakdown || [];
    topicRows.forEach((row) => {
      const attempted = Number(row.attempted) || 0;
      const accuracy = attempted > 0 ? (Number(row.correct) || 0) / attempted : 0;
      const weaknessScore = 1 - accuracy;
      const key = String(row.topicId);
      weakness.set(key, (weakness.get(key) || 0) + weaknessScore);
    });
  });

  return weakness;
}

async function resolveTopics(userId, includeTopics, excludeTopics, includeTopicIds, excludeTopicIds) {
  const progressRows = await TopicProgress.find({ userId })
    .populate({ path: "topicId", select: "name" })
    .lean();

  const fromProgress = progressRows.filter((row) => row.topicId).map((row) => row.topicId);
  const fallbackTopics = await Topic.find({}).select("name").limit(60).lean();

  const pool = fromProgress.length > 0 ? fromProgress : fallbackTopics;

  const includeIds = new Set((includeTopicIds || []).map((id) => String(id)));
  const excludeIds = new Set((excludeTopicIds || []).map((id) => String(id)));
  const includeSet = new Set((includeTopics || []).map((name) => name.toLowerCase()));
  const excludeSet = new Set((excludeTopics || []).map((name) => name.toLowerCase()));

  const filtered = pool.filter((topic) => {
    const id = String(topic._id);
    if (includeIds.size > 0 && !includeIds.has(id)) {
      return false;
    }
    if (excludeIds.has(id)) {
      return false;
    }

    const key = String(topic.name || "").toLowerCase();
    if (includeSet.size > 0 && !includeSet.has(key)) {
      return false;
    }
    if (excludeSet.has(key)) {
      return false;
    }
    return true;
  });

  return filtered.length > 0 ? filtered : pool;
}

function buildDeterministicPracticeQuestions(selectedTopics, count) {
  return Array.from({ length: count }, (_value, index) => {
    const selected = selectedTopics[index % selectedTopics.length];
    const topicName = selected.topic.name;

    return {
      questionId: createQuestionId(index),
      topicId: selected.topic._id,
      topicName,
      type: index % 3 === 0 ? "trueFalse" : "mcq",
      prompt:
        index % 3 === 0
          ? `True or False: The fastest way to improve ${topicName} is to skip error review.`
          : `Pick the most effective next step to improve ${topicName} accuracy in timed practice #${index + 1}.`,
      options:
        index % 3 === 0
          ? ["True", "False"]
          : [
              `Run random tests without revisiting ${topicName}`,
              `Review recent mistakes in ${topicName} and retry similar items`,
              `Ignore ${topicName} until final revision week`,
              `Switch entirely to a different subject`
            ],
      whyAssigned: `Assigned because recent signals show weak performance or retention drift in ${topicName}.`
    };
  });
}

async function buildAiPracticeQuestions({ selectedTopics, count }) {
  if (!isLlmConfigured() || selectedTopics.length === 0) {
    return null;
  }

  const topicRows = selectedTopics.map((entry) => ({
    topicId: String(entry.topic._id),
    topicName: entry.topic.name,
    weaknessScore: Number(entry.weakness.toFixed(3))
  }));

  const systemPrompt = [
    "You are an adaptive exam coach for class 11/12 students.",
    "Generate targeted remedial practice questions in strict JSON.",
    "Questions must reflect weak-topic failure patterns and avoid answer-key leakage.",
    "Use only provided topicIds and keep language clear for Indian competitive exam prep."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate adaptive practice set",
      count,
      topics: topicRows,
      outputRules: {
        jsonShape: {
          questions: [
            {
              topicId: "string",
              type: "mcq|trueFalse",
              prompt: "string",
              options: ["string"],
              whyAssigned: "string"
            }
          ]
        },
        mustUseOnlyProvidedTopicIds: true,
        ifTypeTrueFalseRequireTwoOptions: ["True", "False"]
      }
    },
    null,
    2
  );

  const payload = await getStructuredLlmOutput({
    schema: aiPracticeSetSchema,
    systemPrompt,
    userPrompt,
    temperature: 0.35,
    maxTokens: 2000
  });

  const topicById = new Map(selectedTopics.map((entry) => [String(entry.topic._id), entry.topic]));

  const questions = payload.questions
    .map((question, index) => {
      const topic = topicById.get(String(question.topicId));
      if (!topic) {
        return null;
      }

      const type = question.type;
      const options =
        type === "trueFalse"
          ? ["True", "False"]
          : question.options.slice(0, 4).map((option) => String(option));

      return {
        questionId: createQuestionId(index),
        topicId: topic._id,
        topicName: topic.name,
        type,
        prompt: question.prompt,
        options,
        whyAssigned: question.whyAssigned.includes("weak performance")
          ? question.whyAssigned
          : `${question.whyAssigned} This was assigned due to weak performance signals.`
      };
    })
    .filter(Boolean)
    .slice(0, count);

  return questions.length > 0 ? questions : null;
}

const getNextPracticeSet = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const count = req.body.count || 6;

  const [recentAttempts, progressRows] = await Promise.all([
    ExamAttempt.find({ userId, status: "submitted" }).sort({ submittedAt: -1 }).limit(5).lean(),
    TopicProgress.find({ userId }).select("topicId retentionScore manualCoverage autoCoverageScore").lean()
  ]);

  const weaknessByTopic = normalizeWeaknessByAttempts(recentAttempts);

  progressRows.forEach((row) => {
    const key = String(row.topicId);
    const retentionWeakness = 1 - (Math.min(100, Math.max(0, row.retentionScore || 0)) / 100);
    const coverageWeakness = row.manualCoverage === "uncovered" ? 1 : 1 - (row.autoCoverageScore || 0);
    weaknessByTopic.set(key, (weaknessByTopic.get(key) || 0) + retentionWeakness * 0.5 + coverageWeakness * 0.35);
  });

  const topics = await resolveTopics(
    userId,
    req.body.includeTopics,
    req.body.excludeTopics,
    req.body.includeTopicIds,
    req.body.excludeTopicIds
  );

  const rankedTopics = topics
    .map((topic) => ({
      topic,
      weakness: weaknessByTopic.get(String(topic._id)) || 0.2
    }))
    .sort((left, right) => right.weakness - left.weakness);

  const selectedTopics = rankedTopics.slice(0, Math.max(1, Math.min(rankedTopics.length, 5)));

  let questions;
  let generationSource = "llm";
  let generationError = null;
  let generationRawOutput = null;
  try {
    questions = await buildAiPracticeQuestions({ selectedTopics, count });
  } catch (_error) {
    generationError = String(_error?.message || "Unknown AI practice error").slice(0, 220);
    generationRawOutput = String(_error?.llmRawOutput || "").slice(0, 1200) || null;
    logWarn("practice.ai.fallback", {
      reason: generationError,
      rawOutput: generationRawOutput
    });
    questions = undefined;
  }

  if (!questions) {
    generationSource = "fallback";
    questions = buildDeterministicPracticeQuestions(selectedTopics, count);
  }

  res.json({
    success: true,
    set: {
      generatedAt: new Date().toISOString(),
      generationSource,
      generationDebug:
        generationSource === "fallback"
          ? {
              failed: true,
              error: generationError || "AI practice generation failed and fallback was used",
              rawOutput: generationRawOutput
            }
          : {
              failed: false,
              error: null,
              rawOutput: null
            },
      weakTopics: selectedTopics.map((entry) => ({
        topicId: entry.topic._id,
        topicName: entry.topic.name,
        weaknessScore: Number(entry.weakness.toFixed(3))
      })),
      questions
    }
  });
});

const submitPracticeSession = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    topicId,
    questionCount,
    attemptedCount,
    correctCount,
    totalTimeSec = 0,
    avgConfidence
  } = req.body;

  const topic = await Topic.findById(topicId).select("_id name").lean();
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  const safeQuestionCount = Math.max(1, Number(questionCount) || 1);
  const attempted = Math.max(0, Math.min(safeQuestionCount, Number(attemptedCount) || 0));
  const correct = Math.max(0, Math.min(attempted, Number(correctCount) || 0));
  const incorrect = Math.max(0, attempted - correct);
  const skipped = Math.max(0, safeQuestionCount - attempted);
  const accuracy = attempted > 0 ? correct / attempted : 0;

  const confidence = Number.isFinite(avgConfidence) ? avgConfidence : attempted > 0 ? accuracy : 0.6;

  let outcome = "skipped";
  if (attempted > 0 && accuracy >= 0.75) {
    outcome = "correct";
  } else if (attempted > 0 && accuracy >= 0.45) {
    outcome = "completed";
  } else if (attempted > 0) {
    outcome = "incorrect";
  }

  const existing = await TopicProgress.findOne({ userId, topicId: topic._id });
  const retention = computeRetentionUpdate(existing, {
    outcome,
    confidence,
    occurredAt: new Date()
  });

  const signalType = accuracy >= 0.7 ? "practice_correct" : "practice_incorrect";
  const signalCoverage = applyCoverageSignal(
    { autoCoverageScore: retention.autoCoverageScore },
    signalType
  );

  const progress = await TopicProgress.findOneAndUpdate(
    { userId, topicId: topic._id },
    {
      $set: {
        retentionScore: retention.retentionScore,
        nextReviewAt: retention.nextReviewAt,
        lastReviewedAt: retention.lastReviewedAt,
        lastOutcome: retention.lastOutcome,
        streak: retention.streak,
        totalReviews: retention.totalReviews,
        totalCorrect: retention.totalCorrect,
        totalIncorrect: retention.totalIncorrect,
        autoCoverageScore: signalCoverage
      },
      $inc: {
        practicedQuestions: attempted,
        practicedCorrect: correct
      }
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  await syncSubjectLedgerByTopic(userId, topic._id);

  const practiceAccuracy =
    progress.practicedQuestions > 0 ? progress.practicedCorrect / progress.practicedQuestions : 0;

  res.status(201).json({
    success: true,
    topic: {
      _id: topic._id,
      name: topic.name
    },
    session: {
      questionCount: safeQuestionCount,
      attemptedCount: attempted,
      correctCount: correct,
      incorrectCount: incorrect,
      skippedCount: skipped,
      totalTimeSec: Math.max(0, Number(totalTimeSec) || 0),
      accuracy: Number(accuracy.toFixed(3)),
      avgConfidence: Number(confidence.toFixed(3))
    },
    ledger: {
      practicedQuestions: progress.practicedQuestions,
      practicedCorrect: progress.practicedCorrect,
      practiceAccuracy: Number(practiceAccuracy.toFixed(3)),
      retentionScore: progress.retentionScore,
      autoCoverageScore: Number((progress.autoCoverageScore || 0).toFixed(3))
    }
  });
});

module.exports = {
  getNextPracticeSet,
  submitPracticeSession
};
