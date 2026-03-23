const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { z } = require("zod");
const PlannerTask = require("../models/PlannerTask");
const RevisionEvent = require("../models/RevisionEvent");
const TopicProgress = require("../models/TopicProgress");
const Topic = require("../models/Topic");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");
const { getStructuredLlmOutput, isLlmConfigured } = require("../utils/llmClient");
const { logWarn } = require("../utils/logger");
const {
  toStartOfDay,
  toEndOfDay,
  computePlannerPriority,
  plannerReason,
  computeRetentionUpdate
} = require("../utils/learningEngine");

const aiPlannerTaskSchema = z.object({
  tasks: z.array(
    z.object({
      topicId: z.string().min(1),
      title: z.string().min(3).max(140),
      taskType: z.enum(["review", "practice", "learn"]),
      priorityScore: z.number().min(0).max(100),
      estimatedMinutes: z.number().int().min(10).max(60),
      reason: z.string().min(5).max(220)
    })
  )
});

async function buildTaskCandidates(userId, date) {
  const progressRows = await TopicProgress.find({ userId })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code" }
    })
    .lean();

  const usableRows = progressRows.filter((row) => row.topicId && row.topicId._id);

  const ranked = usableRows
    .map((row) => {
      const priorityScore = computePlannerPriority(row, date);
      return {
        row,
        priorityScore,
        reason: plannerReason(row, priorityScore, date)
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return ranked;
}

async function buildAiPlannerTasks({ userId, date, candidates, regenerate, rebalanceContext }) {
  if (!isLlmConfigured() || candidates.length === 0) {
    return null;
  }

  const maxTasks = 6;
  const candidateRows = candidates.slice(0, 20).map((candidate) => {
    const topic = candidate.row.topicId;
    return {
      topicId: String(topic._id),
      topicName: topic.name,
      chapter: topic.chapter,
      subject: topic.subjectId?.name,
      retentionScore: candidate.row.retentionScore,
      nextReviewAt: candidate.row.nextReviewAt,
      manualCoverage: candidate.row.manualCoverage,
      autoCoverageScore: Number((candidate.row.autoCoverageScore || 0).toFixed(3)),
      practicedQuestions: candidate.row.practicedQuestions || 0,
      practicedCorrect: candidate.row.practicedCorrect || 0,
      lastTestPercentage: candidate.row.lastTestPercentage,
      basePriorityScore: candidate.priorityScore,
      baseReason: candidate.reason
    };
  });

  const systemPrompt = [
    "You are an adaptive study planner for JEE/NEET style preparation.",
    "Generate a balanced one-day plan in strict JSON.",
    "Use only the provided candidate topicIds.",
    "Prioritize weak retention, low coverage, recent incorrect outcomes, and overdue review windows.",
    "Keep reasoning concise and practical for a student."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate daily planner tasks",
      dateISO: date.toISOString(),
      maxTasks,
      mode: rebalanceContext ? "rebalance" : regenerate ? "regenerate" : "normal",
      rebalanceContext,
      outputRules: {
        jsonShape: {
          tasks: [
            {
              topicId: "string",
              title: "string",
              taskType: "review|practice|learn",
              priorityScore: "0..100",
              estimatedMinutes: "10..60",
              reason: "string"
            }
          ]
        },
        mustUseOnlyProvidedTopicIds: true,
        uniqueTopics: true
      },
      candidates: candidateRows
    },
    null,
    2
  );

  const response = await getStructuredLlmOutput({
    schema: aiPlannerTaskSchema,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 1800
  });

  const candidateById = new Map(candidates.map((entry) => [String(entry.row.topicId._id), entry]));
  const usedTopicIds = new Set();

  const normalized = response.tasks
    .map((task) => {
      const candidate = candidateById.get(String(task.topicId));
      if (!candidate) {
        return null;
      }

      const key = String(candidate.row.topicId._id);
      if (usedTopicIds.has(key)) {
        return null;
      }

      usedTopicIds.add(key);
      return {
        userId,
        topicId: candidate.row.topicId._id,
        title: task.title,
        taskType: task.taskType,
        dueDate: date,
        priorityScore: Number(task.priorityScore),
        estimatedMinutes: Number(task.estimatedMinutes),
        reason: task.reason,
        source: regenerate || rebalanceContext ? "rebalance" : "auto"
      };
    })
    .filter(Boolean)
    .slice(0, maxTasks);

  return normalized.length > 0 ? normalized : null;
}

async function ensureProgressSeeds(userId) {
  const progressCount = await TopicProgress.countDocuments({ userId });
  if (progressCount > 0) {
    return;
  }

  const topics = await Topic.find({}).select("_id").limit(24).lean();
  if (topics.length === 0) {
    return;
  }

  await TopicProgress.insertMany(
    topics.map((topic) => ({
      userId,
      topicId: topic._id
    }))
  );
}

function familiarityPenalty(familiarity) {
  if (familiarity === "new") return 20;
  if (familiarity === "basic") return 10;
  return 2;
}

function intentBoost(intent) {
  return intent === "cover" ? 18 : 10;
}

function buildSuggestedDates(prioritizedSelections, dayStart, timeframeDays) {
  const planned = new Map();
  prioritizedSelections.forEach((entry, index) => {
    const offset = Math.min(timeframeDays - 1, index);
    planned.set(entry.topicId, new Date(dayStart.getTime() + offset * 24 * 60 * 60 * 1000));
  });
  return planned;
}

const getDailyPlan = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const regenerate = req.query.regenerate === "true";

  const dayStart = toStartOfDay(date);
  const dayEnd = toEndOfDay(date);

  await ensureProgressSeeds(userId);

  const existing = await PlannerTask.find({
    userId,
    dueDate: { $gte: dayStart, $lte: dayEnd }
  })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code" }
    })
    .sort({ priorityScore: -1, createdAt: 1 });

  if (existing.length > 0 && !regenerate) {
    return res.json({
      success: true,
      plan: {
        date: dayStart,
        regenerated: false,
        tasks: existing
      }
    });
  }

  if (regenerate) {
    await PlannerTask.deleteMany({
      userId,
      dueDate: { $gte: dayStart, $lte: dayEnd },
      status: "todo"
    });
  }

  const candidates = await buildTaskCandidates(userId, dayStart);

  let selected;
  let generationSource = "llm";
  let generationError = null;
  try {
    selected = await buildAiPlannerTasks({
      userId,
      date: dayStart,
      candidates,
      regenerate
    });
  } catch (_error) {
    generationError = String(_error?.message || "Unknown AI planner error").slice(0, 220);
    logWarn("planner.ai.fallback", {
      reason: generationError
    });
    selected = undefined;
  }

  if (!selected) {
    generationSource = "fallback";
    selected = candidates.slice(0, 6).map((candidate) => {
      const topic = candidate.row.topicId;
      const estimatedMinutes = 15 + Math.round((100 - candidate.row.retentionScore) / 10);

      return {
        userId,
        topicId: topic._id,
        title: `Revise ${topic.name}`,
        taskType: "review",
        dueDate: dayStart,
        priorityScore: candidate.priorityScore,
        estimatedMinutes: Math.max(10, Math.min(30, estimatedMinutes)),
        reason: candidate.reason,
        source: regenerate ? "rebalance" : "auto"
      };
    });
  }

  if (selected.length > 0) {
    await PlannerTask.insertMany(selected);
  }

  const tasks = await PlannerTask.find({
    userId,
    dueDate: { $gte: dayStart, $lte: dayEnd }
  })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code" }
    })
    .sort({ priorityScore: -1, createdAt: 1 });

  return res.json({
    success: true,
    plan: {
      date: dayStart,
      regenerated: true,
      tasks,
      generationSource,
      generationDebug:
        generationSource === "fallback"
          ? {
              failed: true,
              error: generationError || "AI generation failed and fallback was used"
            }
          : {
              failed: false,
              error: null
            }
    }
  });
});

const updatePlannerTaskStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { taskId } = req.params;
  const { status } = req.body;

  const task = await PlannerTask.findOne({ _id: taskId, userId });
  if (!task) {
    throw new AppError("Planner task not found", 404);
  }

  task.status = status;
  if (status === "completed") {
    task.completedAt = new Date();
    task.skippedAt = null;
  }
  if (status === "skipped") {
    task.skippedAt = new Date();
    task.completedAt = null;
  }
  if (status === "todo") {
    task.skippedAt = null;
    task.completedAt = null;
  }

  await task.save();

  if (status === "completed" || status === "skipped") {
    const event = await RevisionEvent.create({
      userId,
      topicId: task.topicId,
      source: "planner_task",
      outcome: status === "completed" ? "completed" : "skipped",
      timeSpentSec: status === "completed" ? task.estimatedMinutes * 60 : 0,
      occurredAt: new Date()
    });

    const progress = await TopicProgress.findOne({ userId, topicId: task.topicId });
    const update = computeRetentionUpdate(progress, event);

    await TopicProgress.findOneAndUpdate(
      { userId, topicId: task.topicId },
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
        ...(status === "completed" ? { $inc: { completionCount: 1 } } : {})
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await syncSubjectLedgerByTopic(userId, task.topicId);
  }

  res.json({ success: true, task });
});

const rebalancePlan = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const date = req.body.date ? new Date(req.body.date) : new Date();

  const dayStart = toStartOfDay(date);
  const dayEnd = toEndOfDay(date);

  const todayTasks = await PlannerTask.find({
    userId,
    dueDate: { $gte: dayStart, $lte: dayEnd }
  });

  const overdueCount = await PlannerTask.countDocuments({
    userId,
    dueDate: { $lt: dayStart },
    status: "todo"
  });

  const skippedToday = todayTasks.filter((task) => task.status === "skipped").length;
  const completedToday = todayTasks.filter((task) => task.status === "completed").length;
  const totalToday = todayTasks.length;

  const completionRate = totalToday > 0 ? completedToday / totalToday : 0;
  const shouldRebalance = overdueCount >= 2 || skippedToday >= 2 || completionRate < 0.4;

  if (!shouldRebalance) {
    return res.json({
      success: true,
      rebalanced: false,
      reason: "No rebalance required for current behavior window"
    });
  }

  await PlannerTask.deleteMany({
    userId,
    dueDate: { $gte: dayStart, $lte: dayEnd },
    status: "todo"
  });

  const candidates = await buildTaskCandidates(userId, dayStart);
  let selected;
  let generationSource = "llm";
  let generationError = null;

  try {
    selected = await buildAiPlannerTasks({
      userId,
      date: dayStart,
      candidates,
      regenerate: true,
      rebalanceContext: {
        overdueCount,
        skippedToday,
        completionRate: Number(completionRate.toFixed(3))
      }
    });
  } catch (_error) {
    generationError = String(_error?.message || "Unknown AI rebalance error").slice(0, 220);
    logWarn("planner.rebalance.ai.fallback", {
      reason: generationError
    });
    selected = undefined;
  }

  if (!selected) {
    generationSource = "fallback";
    selected = candidates.slice(0, 6).map((candidate) => ({
      userId,
      topicId: candidate.row.topicId._id,
      title: `Rebalanced: ${candidate.row.topicId.name}`,
      taskType: "review",
      dueDate: dayStart,
      priorityScore: Math.min(100, candidate.priorityScore + 5),
      estimatedMinutes: 20,
      reason: `rebalance trigger: ${candidate.reason}`,
      source: "rebalance"
    }));
  }

  if (selected.length > 0) {
    await PlannerTask.insertMany(selected);
  }

  const tasks = await PlannerTask.find({
    userId,
    dueDate: { $gte: dayStart, $lte: dayEnd }
  })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code" }
    })
    .sort({ priorityScore: -1, createdAt: 1 });

  res.json({
    success: true,
    rebalanced: true,
    trigger: {
      overdueCount,
      skippedToday,
      completionRate
    },
    plan: {
      date: dayStart,
      tasks,
      generationSource,
      generationDebug:
        generationSource === "fallback"
          ? {
              failed: true,
              error: generationError || "AI rebalance failed and fallback was used"
            }
          : {
              failed: false,
              error: null
            }
    }
  });
});

const generateCustomPlan = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { goalText, timeframeDays, selectedTopics } = req.body;

  const dayStart = toStartOfDay(new Date());
  const horizonEnd = toEndOfDay(new Date(dayStart.getTime() + (timeframeDays - 1) * 24 * 60 * 60 * 1000));
  const topicIds = [...new Set(selectedTopics.map((item) => String(item.topicId)))];

  const [topics, progressRows] = await Promise.all([
    Topic.find({ _id: { $in: topicIds } })
      .populate("subjectId", "name code classLevel")
      .lean(),
    TopicProgress.find({ userId, topicId: { $in: topicIds } }).lean()
  ]);

  if (topics.length !== topicIds.length) {
    throw new AppError("One or more selected topics were not found", 404);
  }

  const topicById = new Map(topics.map((topic) => [String(topic._id), topic]));
  const progressByTopic = new Map(progressRows.map((row) => [String(row.topicId), row]));

  const prioritizedSelections = selectedTopics
    .map((selection) => {
      const key = String(selection.topicId);
      const progress = progressByTopic.get(key);
      const retentionScore = progress?.retentionScore ?? 35;
      const practicedQuestions = progress?.practicedQuestions || 0;
      const practicedCorrect = progress?.practicedCorrect || 0;
      const practiceAccuracy = practicedQuestions > 0 ? practicedCorrect / practicedQuestions : 0;
      const coverageGap = 1 - (progress?.autoCoverageScore || 0);
      const priority =
        intentBoost(selection.intent) +
        familiarityPenalty(selection.familiarity) +
        Math.round((100 - retentionScore) * 0.35) +
        Math.round((1 - practiceAccuracy) * 28) +
        Math.round(coverageGap * 18);

      return {
        ...selection,
        topicId: key,
        priority
      };
    })
    .sort((left, right) => right.priority - left.priority);

  const suggestedDates = buildSuggestedDates(prioritizedSelections, dayStart, timeframeDays);

  await PlannerTask.deleteMany({
    userId,
    topicId: { $in: topicIds },
    status: "todo",
    dueDate: { $gte: dayStart, $lte: horizonEnd }
  });

  const tasksToInsert = prioritizedSelections.map((selection) => {
    const topic = topicById.get(selection.topicId);
    const progress = progressByTopic.get(selection.topicId);

    const preferred = selection.preferredDate ? toStartOfDay(new Date(selection.preferredDate)) : null;
    const suggested = suggestedDates.get(selection.topicId) || dayStart;
    const dueDate = preferred && !Number.isNaN(preferred.getTime()) ? preferred : suggested;

    const retentionScore = progress?.retentionScore ?? 35;
    const baseMinutes = selection.familiarity === "new" ? 30 : selection.familiarity === "basic" ? 22 : 16;
    const estimatedMinutes = Math.max(12, Math.min(60, baseMinutes + Math.round((70 - retentionScore) / 8)));
    const verb = selection.intent === "cover" ? "Cover" : "Revise";

    return {
      userId,
      topicId: topic._id,
      title: `${verb} ${topic.name}`,
      taskType: selection.intent === "cover" ? "learn" : "review",
      dueDate,
      priorityScore: Math.max(0, Math.min(100, selection.priority)),
      estimatedMinutes,
      reason: `Goal aligned: ${goalText.slice(0, 80)}${goalText.length > 80 ? "..." : ""}`,
      source: "manual"
    };
  });

  await PlannerTask.insertMany(tasksToInsert);

  const created = await PlannerTask.find({
    userId,
    topicId: { $in: topicIds },
    dueDate: { $gte: dayStart, $lte: horizonEnd }
  })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId",
      populate: { path: "subjectId", select: "name code classLevel" }
    })
    .sort({ dueDate: 1, priorityScore: -1, createdAt: 1 });

  res.status(201).json({
    success: true,
    customPlan: {
      goalText,
      timeframeDays,
      generatedAt: new Date(),
      tasks: created
    }
  });
});

module.exports = {
  getDailyPlan,
  updatePlannerTaskStatus,
  rebalancePlan,
  generateCustomPlan
};
