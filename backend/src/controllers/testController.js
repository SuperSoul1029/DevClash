const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const GeneratedExam = require("../models/GeneratedExam");
const ExamAttempt = require("../models/ExamAttempt");
const Topic = require("../models/Topic");
const TopicProgress = require("../models/TopicProgress");
const { computeCoverageStatus, clamp } = require("../utils/learningEngine");
const { syncSubjectLedgerByTopic } = require("../utils/progressLedger");
const { executeGatewayRequest, isGatewayConfigured } = require("../services/llmGateway");
const { logWarn } = require("../utils/logger");

const DEFAULT_SETTINGS = {
  difficulty: "medium",
  questionCount: 12,
  durationMin: 40,
  typeMix: {
    mcq: 50,
    trueFalse: 25,
    caseStudy: 25
  },
  includeTopics: [],
  excludeTopics: [],
  negativeMarking: {
    enabled: false,
    value: 0.25
  }
};

function createQuestionId(index) {
  return `q-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSettings(payload = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...payload,
    typeMix: {
      ...DEFAULT_SETTINGS.typeMix,
      ...(payload.typeMix || {})
    },
    negativeMarking: {
      ...DEFAULT_SETTINGS.negativeMarking,
      ...(payload.negativeMarking || {})
    },
    includeTopics: payload.includeTopics || DEFAULT_SETTINGS.includeTopics,
    excludeTopics: payload.excludeTopics || DEFAULT_SETTINGS.excludeTopics
  };
}

function normalizeTypeMix(typeMix) {
  const raw = {
    mcq: Number(typeMix?.mcq) || 0,
    trueFalse: Number(typeMix?.trueFalse) || 0,
    caseStudy: Number(typeMix?.caseStudy) || 0
  };

  const total = raw.mcq + raw.trueFalse + raw.caseStudy;
  if (total <= 0) {
    return { ...DEFAULT_SETTINGS.typeMix };
  }

  return {
    mcq: Math.round((raw.mcq / total) * 100),
    trueFalse: Math.round((raw.trueFalse / total) * 100),
    caseStudy: Math.round((raw.caseStudy / total) * 100)
  };
}

function allocateTypeCounts(questionCount, typeMix) {
  const normalized = normalizeTypeMix(typeMix);
  const weighted = Object.entries(normalized).map(([type, percentage]) => ({
    type,
    exact: (percentage / 100) * questionCount
  }));

  const counts = weighted.reduce((accumulator, item) => {
    accumulator[item.type] = Math.floor(item.exact);
    return accumulator;
  }, {});

  let assigned = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const order = [...weighted].sort((left, right) => {
    const leftFraction = left.exact - Math.floor(left.exact);
    const rightFraction = right.exact - Math.floor(right.exact);
    return rightFraction - leftFraction;
  });

  for (let index = 0; assigned < questionCount; index += 1) {
    counts[order[index % order.length].type] += 1;
    assigned += 1;
  }

  return {
    mcq: counts.mcq || 0,
    trueFalse: counts.trueFalse || 0,
    caseStudy: counts.caseStudy || 0
  };
}

function resolveDifficulty(globalDifficulty, index) {
  if (globalDifficulty !== "mixed") {
    return globalDifficulty;
  }

  return ["easy", "medium", "hard"][index % 3];
}

function buildPromptStem(topicName, type, questionIndex) {
  if (type === "trueFalse") {
    return `True or False: Revising ${topicName} with spaced checks always improves retention for case ${questionIndex + 1}.`;
  }

  if (type === "caseStudy") {
    return `Case Study ${questionIndex + 1}: A learner is weak in ${topicName}. Choose the best intervention sequence for measurable improvement.`;
  }

  return `Select the best strategy for solving a ${topicName} exam problem #${questionIndex + 1}.`;
}

function buildQuestion(topic, type, settings, index) {
  const difficulty = resolveDifficulty(settings.difficulty, index);
  const negativeMarks = settings.negativeMarking.enabled ? Number(settings.negativeMarking.value) || 0 : 0;

  if (type === "trueFalse") {
    const correctOptionIndex = (topic.name.length + index) % 2;
    return {
      questionId: createQuestionId(index),
      topicId: topic._id,
      topicName: topic.name,
      type,
      difficulty,
      prompt: buildPromptStem(topic.name, type, index),
      options: ["True", "False"],
      correctOptionIndex,
      explanation:
        "The correct choice follows the underlying concept tested in this statement and the associated exception condition.",
      marks: 1,
      negativeMarks
    };
  }

  const options = [
    `Focus on formula recall only for ${topic.name}`,
    `Skip fundamentals and attempt full mocks immediately`,
    `Use targeted practice and review error patterns for ${topic.name}`,
    `Postpone ${topic.name} and prioritize random topics`
  ];

  const correctOptionIndex = (topic.name.length + difficulty.length + index) % options.length;

  return {
    questionId: createQuestionId(index),
    topicId: topic._id,
    topicName: topic.name,
    type,
    difficulty,
    prompt: buildPromptStem(topic.name, type, index),
    options,
    correctOptionIndex,
    explanation:
      "Targeted attempts plus structured error review improve retention and transfer more reliably than random untargeted practice.",
    marks: 1,
    negativeMarks
  };
}

function buildDeterministicExamQuestions(topics, settings, typeQueue) {
  return typeQueue.map((type, index) => {
    const topic = topics[index % topics.length];
    return buildQuestion(topic, type, settings, index);
  });
}

async function buildAiExamQuestions({ topics, settings, typeCounts }) {
  if (!isGatewayConfigured() || topics.length === 0) {
    return null;
  }

  const typeQueue = [
    ...Array(typeCounts.mcq).fill("mcq"),
    ...Array(typeCounts.trueFalse).fill("trueFalse"),
    ...Array(typeCounts.caseStudy).fill("caseStudy")
  ];

  const allowedTopics = topics.map((topic) => ({
    topicId: String(topic._id),
    topicName: topic.name,
    chapter: topic.chapter,
    classLevel: topic.classLevel
  }));

  const negativeMarks = settings.negativeMarking.enabled ? Number(settings.negativeMarking.value) || 0 : 0;

  const response = await executeGatewayRequest({
    contractKey: "tests.generate.v1",
    input: {
      settings,
      requestedQuestionCount: settings.questionCount,
      requiredTypeOrder: typeQueue,
      requiredTypeCounts: typeCounts,
      negativeMarksPerWrong: negativeMarks,
      allowedTopics
    },
    temperature: 0.3,
    maxTokens: 6000
  });

  if (!response.ok || !response.data) {
    const gatewayError = new Error(
      response.debug?.error?.message ||
        `LLM Gateway test generation failed (${response.status || "unknown_status"})`
    );
    gatewayError.llmRawOutput = response.debug?.rawOutput || null;
    throw gatewayError;
  }

  const payload = response.data;

  const topicById = new Map(topics.map((topic) => [String(topic._id), topic]));

  const normalized = payload.questions
    .map((question, index) => {
      const topic = topicById.get(String(question.topicId));
      if (!topic) {
        return null;
      }

      const options =
        question.type === "trueFalse"
          ? ["True", "False"]
          : question.options.slice(0, 4).map((option) => String(option));

      const targetOptionCount = question.type === "trueFalse" ? 2 : 4;
      if (options.length !== targetOptionCount) {
        return null;
      }

      const correctOptionIndex = Math.max(0, Math.min(options.length - 1, Number(question.correctOptionIndex) || 0));

      return {
        questionId: createQuestionId(index),
        topicId: topic._id,
        topicName: topic.name,
        type: question.type,
        difficulty: question.difficulty,
        prompt: question.prompt,
        options,
        correctOptionIndex,
        explanation: question.explanation,
        marks: Number(question.marks) > 0 ? Number(question.marks) : 1,
        negativeMarks
      };
    })
    .filter(Boolean)
    .slice(0, settings.questionCount);

  return normalized.length > 0 ? normalized : null;
}

function sanitizeExamForAttempt(examDoc) {
  const exam = examDoc.toObject ? examDoc.toObject() : examDoc;

  return {
    _id: exam._id,
    settings: exam.settings,
    blueprint: exam.blueprint,
    status: exam.status,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questions: exam.questions.map((question) => ({
      questionId: question.questionId,
      topicId: question.topicId,
      topicName: question.topicName,
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: question.options,
      marks: question.marks,
      negativeMarks: question.negativeMarks
    }))
  };
}

function mergeResponses(currentResponses, incomingResponses) {
  if (!incomingResponses || incomingResponses.length === 0) {
    return currentResponses;
  }

  const byQuestionId = new Map((currentResponses || []).map((response) => [response.questionId, { ...response }]));

  incomingResponses.forEach((response) => {
    byQuestionId.set(response.questionId, {
      questionId: response.questionId,
      selectedOptionIndex:
        response.selectedOptionIndex === undefined ? null : response.selectedOptionIndex,
      confidence: clamp(response.confidence ?? 0.5, 0, 1),
      timeSpentSec: Math.max(0, Number(response.timeSpentSec) || 0),
      updatedAt: new Date()
    });
  });

  return Array.from(byQuestionId.values());
}

async function resolveTopicsForExam(userId, settings) {
  const progressRows = await TopicProgress.find({ userId })
    .populate({
      path: "topicId",
      select: "name chapter classLevel subjectId"
    })
    .lean();

  const covered = progressRows
    .filter((row) => row.topicId && computeCoverageStatus(row.manualCoverage, row.autoCoverageScore))
    .map((row) => row.topicId);
  let topicPool = covered;

  if (topicPool.length === 0) {
    topicPool = progressRows.filter((row) => row.topicId).map((row) => row.topicId);
  }

  if (topicPool.length === 0) {
    topicPool = await Topic.find({}).select("name chapter classLevel subjectId").limit(60).lean();
  }

  const includeSet = new Set((settings.includeTopics || []).map((value) => value.toLowerCase()));
  const excludeSet = new Set((settings.excludeTopics || []).map((value) => value.toLowerCase()));

  const filtered = topicPool.filter((topic) => {
    const name = String(topic.name || "").toLowerCase();
    if (includeSet.size > 0 && !includeSet.has(name)) {
      return false;
    }
    if (excludeSet.has(name)) {
      return false;
    }
    return true;
  });

  return filtered.length > 0 ? filtered : topicPool;
}

const getGeneratedExams = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const exams = await GeneratedExam.find({ userId }).sort({ createdAt: -1 }).limit(20);

  res.json({
    success: true,
    exams: exams.map(sanitizeExamForAttempt)
  });
});

const generateExam = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const settings = normalizeSettings(req.body);
  const topics = await resolveTopicsForExam(userId, settings);

  if (topics.length === 0) {
    throw new AppError("No topics available to generate exam", 400);
  }

  const typeCounts = allocateTypeCounts(settings.questionCount, settings.typeMix);
  const typeQueue = [
    ...Array(typeCounts.mcq).fill("mcq"),
    ...Array(typeCounts.trueFalse).fill("trueFalse"),
    ...Array(typeCounts.caseStudy).fill("caseStudy")
  ];

  let questions;
  let generationSource = "llm";
  let generationError = null;
  let generationRawOutput = null;
  try {
    questions = await buildAiExamQuestions({
      topics,
      settings,
      typeCounts
    });
  } catch (_error) {
    generationError = String(_error?.message || "Unknown AI tests error").slice(0, 220);
    generationRawOutput = String(_error?.llmRawOutput || "").slice(0, 1200) || null;
    logWarn("tests.ai.fallback", {
      reason: generationError,
      rawOutput: generationRawOutput
    });
    questions = undefined;
  }

  if (!questions || questions.length < settings.questionCount) {
    generationSource = "fallback";
    const deterministic = buildDeterministicExamQuestions(topics, settings, typeQueue);
    const existing = Array.isArray(questions) ? questions : [];
    const needed = Math.max(0, settings.questionCount - existing.length);
    const filler = deterministic.slice(0, needed).map((question, index) => ({
      ...question,
      questionId: createQuestionId(existing.length + index)
    }));
    questions = [...existing, ...filler];
  }

  const exam = await GeneratedExam.create({
    userId,
    settings,
    blueprint: {
      resolvedTopicIds: topics.map((topic) => topic._id),
      resolvedTopicNames: topics.map((topic) => topic.name),
      typeCounts,
      generatedAt: new Date()
    },
    questions,
    status: "generated"
  });

  res.status(201).json({
    success: true,
    exam: sanitizeExamForAttempt(exam),
    generationSource,
    generationDebug:
      generationSource === "fallback"
        ? {
            failed: true,
            error: generationError || "AI exam generation failed and fallback was used",
            rawOutput: generationRawOutput
          }
        : {
            failed: false,
            error: null,
            rawOutput: null
          }
  });
});

const startExam = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { examId } = req.body;

  const exam = await GeneratedExam.findOne({ _id: examId, userId });
  if (!exam) {
    throw new AppError("Generated exam not found", 404);
  }

  let attempt = await ExamAttempt.findOne({ userId, examId, status: "in_progress" });
  if (!attempt) {
    attempt = await ExamAttempt.create({
      userId,
      examId,
      status: "in_progress",
      startedAt: new Date(),
      lastSavedAt: new Date(),
      responses: []
    });
  }

  if (exam.status === "generated") {
    exam.status = "active";
    await exam.save();
  }

  res.status(201).json({
    success: true,
    attempt: {
      _id: attempt._id,
      examId: attempt.examId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      lastSavedAt: attempt.lastSavedAt,
      elapsedSec: attempt.elapsedSec,
      responses: attempt.responses
    },
    exam: sanitizeExamForAttempt(exam)
  });
});

const saveExamAttempt = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { attemptId, responses, elapsedSec } = req.body;

  const attempt = await ExamAttempt.findOne({ _id: attemptId, userId, status: "in_progress" });
  if (!attempt) {
    throw new AppError("Active attempt not found", 404);
  }

  attempt.responses = mergeResponses(attempt.responses, responses);
  if (Number.isFinite(elapsedSec)) {
    attempt.elapsedSec = Math.max(0, elapsedSec);
  }
  attempt.lastSavedAt = new Date();
  await attempt.save();

  res.json({
    success: true,
    attempt: {
      _id: attempt._id,
      status: attempt.status,
      lastSavedAt: attempt.lastSavedAt,
      elapsedSec: attempt.elapsedSec,
      savedResponses: attempt.responses.length
    }
  });
});

function gradeAttempt(exam, responses) {
  const responseMap = new Map((responses || []).map((response) => [response.questionId, response]));

  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let negativeMarksApplied = 0;

  const topicStats = new Map();

  exam.questions.forEach((question) => {
    const marks = Number(question.marks) || 1;
    const penalty = Number(question.negativeMarks) || 0;
    maxScore += marks;

    const response = responseMap.get(question.questionId);
    const selected = response && Number.isInteger(response.selectedOptionIndex) ? response.selectedOptionIndex : null;
    const attempted = selected !== null;
    const isCorrect = attempted && selected === question.correctOptionIndex;

    const topicKey = String(question.topicId);
    if (!topicStats.has(topicKey)) {
      topicStats.set(topicKey, {
        topicId: question.topicId,
        topicName: question.topicName,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        score: 0
      });
    }

    const stats = topicStats.get(topicKey);

    if (!attempted) {
      unattemptedCount += 1;
      return;
    }

    stats.attempted += 1;

    if (isCorrect) {
      score += marks;
      correctCount += 1;
      stats.correct += 1;
      stats.score += marks;
      return;
    }

    incorrectCount += 1;
    stats.incorrect += 1;

    if (penalty > 0) {
      score -= penalty;
      negativeMarksApplied += penalty;
      stats.score -= penalty;
    }
  });

  const topicBreakdown = Array.from(topicStats.values());
  const weakTopicIds = topicBreakdown
    .filter((item) => {
      if (item.attempted === 0) {
        return true;
      }
      return item.correct / item.attempted < 0.6;
    })
    .map((item) => item.topicId);

  return {
    score: Number(score.toFixed(2)),
    maxScore: Number(maxScore.toFixed(2)),
    correctCount,
    incorrectCount,
    unattemptedCount,
    negativeMarksApplied: Number(negativeMarksApplied.toFixed(2)),
    topicBreakdown,
    weakTopicIds
  };
}

async function updateLedgerFromSubmittedAttempt(userId, exam, gradedResult) {
  const maxScoreByTopic = new Map();

  exam.questions.forEach((question) => {
    const key = String(question.topicId);
    maxScoreByTopic.set(key, (maxScoreByTopic.get(key) || 0) + (Number(question.marks) || 1));
  });

  const operations = gradedResult.topicBreakdown.map((row) => {
    const topicId = row.topicId;
    const maxTopicScore = maxScoreByTopic.get(String(topicId)) || 0;
    const attempted = row.attempted || 0;
    const correct = row.correct || 0;
    const score = Number(row.score) || 0;
    const percentage = maxTopicScore > 0 ? clamp((score / maxTopicScore) * 100, 0, 100) : 0;

    return {
      updateOne: {
        filter: { userId, topicId },
        update: {
          $inc: {
            practicedQuestions: attempted,
            practicedCorrect: correct,
            testsTaken: attempted > 0 ? 1 : 0,
            cumulativeTestScore: score,
            cumulativeTestMaxScore: maxTopicScore
          },
          $set: {
            lastTestPercentage: Number(percentage.toFixed(2))
          }
        },
        upsert: true
      }
    };
  });

  if (operations.length > 0) {
    await TopicProgress.bulkWrite(operations, { ordered: false });
    await Promise.all(
      gradedResult.topicBreakdown.map((row) => syncSubjectLedgerByTopic(userId, row.topicId))
    );
  }
}

const submitExamAttempt = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { attemptId, responses, elapsedSec, proctoringLogs } = req.body;

  const attempt = await ExamAttempt.findOne({ _id: attemptId, userId, status: "in_progress" });
  if (!attempt) {
    throw new AppError("Active attempt not found", 404);
  }

  const exam = await GeneratedExam.findOne({ _id: attempt.examId, userId });
  if (!exam) {
    throw new AppError("Generated exam not found", 404);
  }

  attempt.responses = mergeResponses(attempt.responses, responses);
  if (Number.isFinite(elapsedSec)) {
    attempt.elapsedSec = Math.max(0, elapsedSec);
  }
  if (Array.isArray(proctoringLogs) && proctoringLogs.length > 0) {
    attempt.proctoringLogs = [
      ...(attempt.proctoringLogs || []),
      ...proctoringLogs.map((entry) => ({
        type: entry.type,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
        details: entry.details || {}
      }))
    ];
  }

  const graded = gradeAttempt(exam, attempt.responses);

  attempt.status = "submitted";
  attempt.submittedAt = new Date();
  attempt.lastSavedAt = new Date();
  attempt.result = graded;
  await attempt.save();

  await updateLedgerFromSubmittedAttempt(userId, exam, graded);

  exam.status = "submitted";
  await exam.save();

  res.json({
    success: true,
    submission: {
      attemptId: attempt._id,
      examId: exam._id,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      score: graded.score,
      maxScore: graded.maxScore,
      correctCount: graded.correctCount,
      incorrectCount: graded.incorrectCount,
      unattemptedCount: graded.unattemptedCount
    }
  });
});

const getExamResult = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { attemptId } = req.params;

  const attempt = await ExamAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) {
    throw new AppError("Exam attempt not found", 404);
  }

  if (attempt.status !== "submitted") {
    throw new AppError("Result is locked until final submission", 403);
  }

  const exam = await GeneratedExam.findOne({ _id: attempt.examId, userId });
  if (!exam) {
    throw new AppError("Generated exam not found", 404);
  }

  const responseMap = new Map((attempt.responses || []).map((response) => [response.questionId, response]));

  const review = exam.questions.map((question) => {
    const response = responseMap.get(question.questionId);
    const selectedOptionIndex = Number.isInteger(response?.selectedOptionIndex)
      ? response.selectedOptionIndex
      : null;

    return {
      questionId: question.questionId,
      topicId: question.topicId,
      topicName: question.topicName,
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: question.options,
      selectedOptionIndex,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      isCorrect: selectedOptionIndex !== null && selectedOptionIndex === question.correctOptionIndex
    };
  });

  res.json({
    success: true,
    result: {
      attemptId: attempt._id,
      examId: exam._id,
      submittedAt: attempt.submittedAt,
      score: attempt.result.score,
      maxScore: attempt.result.maxScore,
      correctCount: attempt.result.correctCount,
      incorrectCount: attempt.result.incorrectCount,
      unattemptedCount: attempt.result.unattemptedCount,
      negativeMarksApplied: attempt.result.negativeMarksApplied,
      topicBreakdown: attempt.result.topicBreakdown,
      weakTopicIds: attempt.result.weakTopicIds,
      review
    }
  });
});

const getTestHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { topicId, limit = 12 } = req.query;

  const attempts = await ExamAttempt.find({ userId, status: "submitted" })
    .select("_id submittedAt result")
    .sort({ submittedAt: -1 })
    .limit(limit)
    .lean();

  const history = attempts
    .map((attempt) => {
      const maxScore = Number(attempt.result?.maxScore) || 0;
      const score = Number(attempt.result?.score) || 0;
      const percentage = maxScore > 0 ? clamp((score / maxScore) * 100, 0, 100) : 0;

      const rows = Array.isArray(attempt.result?.topicBreakdown) ? attempt.result.topicBreakdown : [];
      const topicRow = topicId
        ? rows.find((row) => String(row.topicId) === String(topicId)) || null
        : rows[0] || null;

      if (topicId && !topicRow) {
        return null;
      }

      const attempted = topicRow?.attempted || 0;
      const correct = topicRow?.correct || 0;
      const topicAccuracy = attempted > 0 ? correct / attempted : 0;

      return {
        attemptId: attempt._id,
        submittedAt: attempt.submittedAt,
        overallScore: Number(score.toFixed(2)),
        overallMaxScore: Number(maxScore.toFixed(2)),
        overallPercentage: Number(percentage.toFixed(2)),
        topic: topicRow
          ? {
              topicId: topicRow.topicId,
              topicName: topicRow.topicName,
              attempted,
              correct,
              incorrect: topicRow.incorrect || 0,
              accuracy: Number(topicAccuracy.toFixed(3)),
              score: Number((topicRow.score || 0).toFixed(2))
            }
          : null
      };
    })
    .filter(Boolean);

  res.json({
    success: true,
    history
  });
});

module.exports = {
  getGeneratedExams,
  generateExam,
  startExam,
  saveExamAttempt,
  submitExamAttempt,
  getExamResult,
  getTestHistory
};
