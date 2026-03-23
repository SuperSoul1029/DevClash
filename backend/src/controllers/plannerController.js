const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const PlannerTask = require("../models/PlannerTask");
const RevisionEvent = require("../models/RevisionEvent");
const TopicProgress = require("../models/TopicProgress");
const Topic = require("../models/Topic");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");
const { executeGatewayRequest, isGatewayConfigured } = require("../services/llmGateway");
const { logWarn } = require("../utils/logger");
const {
  toStartOfDay,
  toEndOfDay,
  computeCoverageStatus,
  computePlannerPriority,
  plannerReason,
  computeRetentionUpdate
} = require("../utils/learningEngine");

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
  if (!isGatewayConfigured() || candidates.length === 0) {
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

  const response = await executeGatewayRequest({
    contractKey: "planner.daily.tasks.v1",
    input: {
      dateISO: date.toISOString(),
      maxTasks,
      mode: rebalanceContext ? "rebalance" : regenerate ? "regenerate" : "normal",
      rebalanceContext,
      candidates: candidateRows
    },
    temperature: 0.2,
    maxTokens: 1800
  });

  if (!response.ok || !response.data) {
    const gatewayError = new Error(
      response.debug?.error?.message || "LLM Gateway planner generation failed"
    );
    gatewayError.llmRawOutput = response.debug?.rawOutput || null;
    throw gatewayError;
  }

  const candidateById = new Map(candidates.map((entry) => [String(entry.row.topicId._id), entry]));
  const usedTopicIds = new Set();

  const normalized = response.data.tasks
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

function startOfSundayWeek(anchorDate) {
  const start = toStartOfDay(anchorDate);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfSundayWeek(start) {
  return toEndOfDay(new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
}

function addDays(baseDate, dayCount) {
  const date = toStartOfDay(baseDate);
  date.setDate(date.getDate() + dayCount);
  return date;
}

function calculateRecommendedRevisionDate(totalReviews, lastReviewedAt, nextReviewAt) {
  const reviews = Number(totalReviews || 0);

  if (reviews <= 0) {
    return null;
  }

  if (!lastReviewedAt) {
    return nextReviewAt ? toStartOfDay(nextReviewAt) : null;
  }

  const anchor = toStartOfDay(lastReviewedAt);

  if (reviews === 1) return addDays(anchor, 2);
  if (reviews === 2) return addDays(anchor, 5);
  if (reviews === 3) return addDays(anchor, 7);
  if (reviews === 4) return addDays(anchor, 10);
  if (reviews === 5) return addDays(anchor, 30);

  return nextReviewAt ? toStartOfDay(nextReviewAt) : null;
}

function difficultyProfile(difficulty) {
  if (difficulty === "hard") {
    return {
      sessions: 3,
      baseMinutes: 58,
      basePriority: 86
    };
  }

  if (difficulty === "easy") {
    return {
      sessions: 1,
      baseMinutes: 28,
      basePriority: 62
    };
  }

  return {
    sessions: 2,
    baseMinutes: 42,
    basePriority: 74
  };
}

function selectBestDayIndex(dayLoad, usedDayIndexes, dayCount) {
  let best = null;

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const load = dayLoad[dayIndex] || 0;
    const alreadyUsed = usedDayIndexes.has(dayIndex);
    const candidate = {
      dayIndex,
      load,
      alreadyUsed
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.alreadyUsed !== best.alreadyUsed) {
      if (!candidate.alreadyUsed) {
        best = candidate;
      }
      continue;
    }

    if (candidate.load < best.load) {
      best = candidate;
      continue;
    }

    if (candidate.load === best.load && candidate.dayIndex < best.dayIndex) {
      best = candidate;
    }
  }

  return best ? best.dayIndex : 0;
}

async function fetchWeeklyTasksWithTopic(userId, weekStart, weekEnd) {
  return PlannerTask.find({
    userId,
    dueDate: { $gte: weekStart, $lte: weekEnd }
  })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId difficulty",
      populate: { path: "subjectId", select: "name code classLevel" }
    })
    .sort({ dueDate: 1, priorityScore: -1, createdAt: 1 });
}

const getWeeklyPlan = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const anchor = req.query.date ? new Date(req.query.date) : new Date();
  const weekStart = startOfSundayWeek(anchor);
  const weekEnd = endOfSundayWeek(weekStart);

  const tasks = await fetchWeeklyTasksWithTopic(userId, weekStart, weekEnd);

  res.json({
    success: true,
    plan: {
      weekStart,
      weekEnd,
      tasks
    }
  });
});

const generateWeeklyPlan = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const weekAnchor = req.body.weekStart ? new Date(req.body.weekStart) : new Date();
  const selectedTopicIds = [...new Set((req.body.selectedTopicIds || []).map(String))];
  const regenerate = Boolean(req.body.regenerate);
  const selectedTopicIdSet = new Set(selectedTopicIds);

  const weekStart = startOfSundayWeek(weekAnchor);
  const weekEnd = endOfSundayWeek(weekStart);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  if (regenerate) {
    await PlannerTask.deleteMany({
      userId,
      dueDate: { $gte: weekStart, $lte: weekEnd }
    });
  }

  const [progressRows, selectedTopics] = await Promise.all([
    TopicProgress.find({ userId })
      .populate({
        path: "topicId",
        select: "name chapter classLevel subjectId difficulty",
        populate: { path: "subjectId", select: "name code classLevel" }
      })
      .lean(),
    selectedTopicIds.length
      ? Topic.find({ _id: { $in: selectedTopicIds } })
          .populate("subjectId", "name code classLevel")
          .lean()
      : []
  ]);

  if (selectedTopics.length !== selectedTopicIds.length) {
    throw new AppError("One or more selected topics were not found", 404);
  }

  if (!regenerate) {
    await PlannerTask.deleteMany({
      userId,
      dueDate: { $gte: weekStart, $lte: weekEnd }
    });
  }

  const progressByTopic = new Map(
    progressRows.filter((row) => row.topicId?._id).map((row) => [String(row.topicId._id), row])
  );

  const dayLoad = weekDates.reduce((acc, _, index) => {
    acc[index] = 0;
    return acc;
  }, {});

  const tasksToInsert = [];
  const dueCoveredTopicIds = new Set();

  progressRows.forEach((row) => {
    const topic = row.topicId;
    if (!topic?._id) {
      return;
    }

    const isCovered = computeCoverageStatus(row.manualCoverage, row.autoCoverageScore || 0);
    if (!isCovered) {
      return;
    }

    const hasExplicitRevisionPlan = Boolean(row.lastReviewedAt || Number(row.totalReviews || 0) > 0);
    if (!hasExplicitRevisionPlan) {
      return;
    }

    const recommended = calculateRecommendedRevisionDate(
      row.totalReviews,
      row.lastReviewedAt,
      row.nextReviewAt
    );

    if (!recommended) {
      return;
    }

    if (recommended < weekStart || recommended > weekEnd) {
      return;
    }

    const dayIndex = Math.min(6, Math.max(0, Math.round((recommended - weekStart) / (24 * 60 * 60 * 1000))));
    dayLoad[dayIndex] = (dayLoad[dayIndex] || 0) + 1;
    dueCoveredTopicIds.add(String(topic._id));

    tasksToInsert.push({
      userId,
      topicId: topic._id,
      title: `Revise ${topic.name}`,
      taskType: "review",
      dueDate: recommended,
      status: "todo",
      priorityScore: 78,
      estimatedMinutes: 24,
      reason: "Recommended revision date from topic tracker",
      source: "auto"
    });
  });

  const selectedUncovered = selectedTopics
    .filter((topic) => {
      if (!selectedTopicIdSet.has(String(topic._id))) {
        return false;
      }

      const progress = progressByTopic.get(String(topic._id));
      return !computeCoverageStatus(progress?.manualCoverage || null, progress?.autoCoverageScore || 0);
    })
    .sort((left, right) => {
      const weight = { hard: 3, medium: 2, easy: 1 };
      const leftWeight = weight[left.difficulty] || 2;
      const rightWeight = weight[right.difficulty] || 2;
      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight;
      }
      return left.name.localeCompare(right.name);
    });

  selectedUncovered.forEach((topic) => {
    const profile = difficultyProfile(topic.difficulty);
    const usedDayIndexes = new Set();

    for (let session = 0; session < profile.sessions; session += 1) {
      const dayIndex = selectBestDayIndex(dayLoad, usedDayIndexes, weekDates.length);
      const dueDate = weekDates[dayIndex];
      const taskType = session === 0 ? "learn" : "practice";

      const estimatedMinutes = Math.max(20, profile.baseMinutes - session * 8);
      const priorityScore = Math.max(35, profile.basePriority - session * 6);

      tasksToInsert.push({
        userId,
        topicId: topic._id,
        title: `${session === 0 ? "Cover" : "Practice"} ${topic.name}`,
        taskType,
        dueDate,
        status: "todo",
        priorityScore,
        estimatedMinutes,
        reason: `${topic.difficulty || "medium"} difficulty topic scheduled with weighted weekly sessions`,
        source: "manual"
      });

      dayLoad[dayIndex] = (dayLoad[dayIndex] || 0) + 1;
      usedDayIndexes.add(dayIndex);
    }
  });

  if (tasksToInsert.length > 0) {
    await PlannerTask.insertMany(tasksToInsert);
  }

  const tasks = await fetchWeeklyTasksWithTopic(userId, weekStart, weekEnd);

  res.status(201).json({
    success: true,
    plan: {
      weekStart,
      weekEnd,
      tasks,
      stats: {
        coveredRevisionTasks: tasks.filter((task) => task.taskType === "review").length,
        uncoveredTasks: tasks.filter((task) => task.taskType !== "review").length,
        selectedUncoveredTopics: selectedUncovered.length,
        coveredTopicsDueThisWeek: dueCoveredTopicIds.size
      }
    }
  });
});

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
  let generationRawOutput = null;
  try {
    selected = await buildAiPlannerTasks({
      userId,
      date: dayStart,
      candidates,
      regenerate
    });
  } catch (_error) {
    generationError = String(_error?.message || "Unknown AI planner error").slice(0, 220);
    generationRawOutput = String(_error?.llmRawOutput || "").slice(0, 1200) || null;
    logWarn("planner.ai.fallback", {
      reason: generationError,
      rawOutput: generationRawOutput
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
              error: generationError || "AI generation failed and fallback was used",
              rawOutput: generationRawOutput
            }
          : {
              failed: false,
              error: null,
              rawOutput: null
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
  let generationRawOutput = null;

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
    generationRawOutput = String(_error?.llmRawOutput || "").slice(0, 1200) || null;
    logWarn("planner.rebalance.ai.fallback", {
      reason: generationError,
      rawOutput: generationRawOutput
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
              error: generationError || "AI rebalance failed and fallback was used",
              rawOutput: generationRawOutput
            }
          : {
              failed: false,
              error: null,
              rawOutput: null
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
  getWeeklyPlan,
  generateWeeklyPlan,
  getDailyPlan,
  updatePlannerTaskStatus,
  rebalancePlan,
  generateCustomPlan
};
