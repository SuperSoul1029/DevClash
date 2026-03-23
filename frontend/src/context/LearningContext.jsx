import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/apiClient.js'
import { useAuth } from './AuthContext.jsx'

const DEFAULT_TEST_SETTINGS = {
  difficulty: 'medium',
  questionCount: 12,
  durationMin: 40,
  typeMix: {
    mcq: 50,
    trueFalse: 25,
    caseStudy: 25,
  },
  includeTopics: [],
  excludeTopics: [],
  negativeMarking: {
    enabled: false,
    value: 0.25,
  },
}

const CONFIDENCE_TO_VALUE = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
}

const LearningContext = createContext(null)

function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function confidenceLabel(value) {
  if (value >= 67) return 'High'
  if (value >= 45) return 'Medium'
  return 'Low'
}

function toConfidenceLevel(value) {
  if (value >= 0.75) return 'high'
  if (value >= 0.45) return 'medium'
  return 'low'
}

function addDays(baseDate, dayCount) {
  const date = new Date(baseDate)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + dayCount)
  return date
}

function calculateRecommendedRevisionDate(totalReviews, lastReviewedAt) {
  const reviews = Number(totalReviews || 0)

  if (reviews <= 0) {
    return addDays(new Date(), 1)
  }

  if (!lastReviewedAt) {
    return addDays(new Date(), 1)
  }

  const anchor = new Date(lastReviewedAt)

  if (reviews === 1) return addDays(anchor, 2)
  if (reviews === 2) return addDays(anchor, 5)
  if (reviews === 3) return addDays(anchor, 7)
  if (reviews === 4) return addDays(anchor, 10)
  if (reviews === 5) return addDays(anchor, 30)

  return null
}

function mapTask(task) {
  return {
    id: task._id,
    title: task.title,
    topic: task.topicId?.name || 'Topic',
    type: task.taskType === 'review' ? 'Revision' : task.taskType,
    durationMin: task.estimatedMinutes || 20,
    scheduledDate: formatDateKey(task.dueDate),
    status: task.status,
    raw: task,
  }
}

function mapDisplayStatus(task, todayKey) {
  if (task.status === 'completed') return 'Completed'
  if (task.status === 'skipped') return 'Skipped'
  if (task.scheduledDate < todayKey) return 'Overdue'
  if (task.scheduledDate === todayKey) return 'Today'
  return 'Scheduled'
}

function mapCoverageTopic(item) {
  const manual = item.manualCoverage
  const overrideLabel =
    manual === 'covered' ? 'Manual Marked' : manual === 'uncovered' ? 'Manual Unmarked' : 'Auto'
  const recommendedRevisionDate = calculateRecommendedRevisionDate(item.totalReviews || 0, item.lastReviewedAt)
  const isRevisionDue = Boolean(recommendedRevisionDate && recommendedRevisionDate <= new Date())

  return {
    id: item.topic._id,
    name: item.topic.name,
    subjectName: item.topic.subject?.name || 'Uncategorized',
    subjectCode: item.topic.subject?.code || '',
    classLevel: item.topic.classLevel || '',
    difficulty: item.topic.difficulty || 'medium',
    confidence: confidenceLabel(item.confidence ?? 0),
    autoCovered: Boolean(item.autoCoverageScore >= 0.6),
    manualOverride: manual === 'covered' ? 'covered' : manual === 'uncovered' ? 'not-covered' : null,
    covered: Boolean(item.effectiveCovered),
    status: item.effectiveCovered ? 'Covered' : 'Needs Practice',
    overrideLabel,
    completionCount: item.completionCount || 0,
    retentionScore: item.retentionScore || 0,
    totalReviews: item.totalReviews || 0,
    lastReviewedAt: item.lastReviewedAt || null,
    nextReviewAt: item.nextReviewAt || null,
    recommendedRevisionDate,
    recommendedRevisionText: recommendedRevisionDate
      ? recommendedRevisionDate.toLocaleDateString()
      : 'At your convenience',
    isRevisionDue,
    practicedQuestions: item.practicedQuestions || 0,
    practicedCorrect: item.practicedCorrect || 0,
    practiceAccuracy: item.practiceAccuracy || 0,
    testsTaken: item.testsTaken || 0,
    averageTestPercentage: item.averageTestPercentage || 0,
    lastTestPercentage: item.lastTestPercentage,
    _raw: item,
  }
}

function mapSubjectProgress(item) {
  return {
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    subjectCode: item.subjectCode,
    classLevel: item.classLevel,
    totalTopics: item.totalTopics || 0,
    coveredTopics: item.coveredTopics || 0,
    uncoveredTopics: item.uncoveredTopics || 0,
    completionCount: item.completionCount || 0,
    practicedQuestions: item.practicedQuestions || 0,
    practicedCorrect: item.practicedCorrect || 0,
    practiceAccuracy: item.practiceAccuracy || 0,
    testsTaken: item.testsTaken || 0,
    averageTestPercentage: item.averageTestPercentage || 0,
  }
}

function mapExamQuestion(question) {
  return {
    id: question.questionId,
    topic: question.topicName,
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
  }
}

function mapExam(exam) {
  return {
    id: exam._id,
    name: `${exam.settings.difficulty[0].toUpperCase()}${exam.settings.difficulty.slice(1)} Adaptive Set`,
    createdAt: exam.createdAt,
    settings: {
      ...DEFAULT_TEST_SETTINGS,
      ...exam.settings,
    },
    blueprint: {
      topics: exam.blueprint?.resolvedTopicNames || [],
      typeCounts: exam.blueprint?.typeCounts || DEFAULT_TEST_SETTINGS.typeMix,
    },
    questions: Array.isArray(exam.questions) ? exam.questions.map(mapExamQuestion) : [],
  }
}

function mapReviewToTopicBreakdown(review, topicBreakdown) {
  const byTopic = new Map()

  review.forEach((item) => {
    const current = byTopic.get(item.topicName) || {
      topic: item.topicName,
      attempted: 0,
      correct: 0,
      timeSpentSec: 0,
      confidenceScore: 0,
    }

    if (item.selectedOptionIndex !== null && item.selectedOptionIndex !== undefined) {
      current.attempted += 1
      current.correct += item.isCorrect ? 1 : 0
    }

    current.timeSpentSec += item.timeSpentSec || 0
    current.confidenceScore += CONFIDENCE_TO_VALUE[item.confidence] || CONFIDENCE_TO_VALUE.medium

    byTopic.set(item.topicName, current)
  })

  return topicBreakdown.map((row) => {
    const local = byTopic.get(row.topicName)
    const attempted = row.attempted || local?.attempted || 0
    const correct = row.correct || local?.correct || 0
    const accuracy = attempted > 0 ? correct / attempted : 0
    const avgConf = attempted > 0 ? (local?.confidenceScore || 0) / attempted : CONFIDENCE_TO_VALUE.medium

    return {
      topic: row.topicName,
      attempted,
      correct,
      accuracy,
      accuracyLabel: `${Math.round(accuracy * 100)}%`,
      avgConfidence: avgConf >= 0.75 ? 'High' : avgConf >= 0.45 ? 'Medium' : 'Low',
      timeSpentMin: Math.max(1, Math.round((local?.timeSpentSec || 0) / 60)),
    }
  })
}

function createAdaptiveSetId(generatedAt) {
  return `practice-${Date.parse(generatedAt) || Date.now()}`
}

function mapPracticeQuestion(question) {
  return {
    id: question.questionId,
    topicId: question.topicId,
    topicName: question.topicName,
    type: question.type,
    prompt: question.prompt,
    options: question.options || [],
    rationale: question.whyAssigned,
  }
}

function mapYoutubeOutput(result, jobId) {
  if (!result) return null

  return {
    mode: result.fallbackUsed ? 'demo-fallback' : 'transcript',
    generatedAt: new Date().toISOString(),
    title: 'YouTube Explainer Result',
    overview: result.overview,
    bullets: result.bullets || [],
    concepts: result.keyConcepts || [],
    revisionCards: (result.revisionCards || []).map((card, index) => ({
      id: `${jobId}-card-${index + 1}`,
      title: card.title,
      why: card.answer || 'Recommended for revision reinforcement.',
      prompt: card.prompt,
    })),
  }
}

function mapYoutubeJob(job) {
  const status =
    job.status === 'completed' ? 'succeeded' : job.status === 'failed' ? 'failed' : 'processing'

  return {
    id: job.jobId,
    url: job.sourceUrl,
    createdAt: job.createdAt,
    updatedAt: job.completedAt || job.startedAt || job.createdAt,
    status,
    progressStep:
      status === 'succeeded'
        ? 'Completed successfully'
        : status === 'failed'
          ? 'Failed during processing'
          : `Processing (${job.progress || 0}%)`,
    progressIndex: Math.max(1, Math.ceil((job.progress || 0) / 20)),
    attemptCount: 1,
    output: mapYoutubeOutput(job.result, job.jobId),
    errorMessage: job.error || null,
    usedFallback: Boolean(job.result?.fallbackUsed),
  }
}

function resolveGenerationSource(payload = {}, scopeKey = null) {
  if (scopeKey && payload?.[scopeKey]?.generationSource) {
    return payload[scopeKey].generationSource
  }

  return payload?.generationSource || null
}

function resolveGenerationDebug(payload = {}, scopeKey = null) {
  if (scopeKey && payload?.[scopeKey]?.generationDebug) {
    return payload[scopeKey].generationDebug
  }

  return payload?.generationDebug || null
}

function formatAiFallbackDebug(generationDebug, fallbackMessage, generationSource = 'llm') {
  const usedFallback = String(generationSource || '').toLowerCase().includes('fallback')
  if (!usedFallback && !generationDebug?.failed) {
    return null
  }

  const errorText = generationDebug?.error || fallbackMessage
  const rawOutput = typeof generationDebug?.rawOutput === 'string' ? generationDebug.rawOutput.trim() : ''

  return `${errorText} | Model output: ${rawOutput || '[empty or unavailable]'}`
}

function LearningProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [plannerView, setPlannerViewState] = useState(() =>
    window.localStorage.getItem('devclash-planner-view') === 'list' ? 'list' : 'calendar',
  )
  const [retentionScore, setRetentionScore] = useState(0)
  const [tasks, setTasks] = useState([])
  const [topics, setTopics] = useState([])
  const [todayPlan, setTodayPlan] = useState(0)
  const [overdueTasks, setOverdueTasks] = useState(0)
  const [completedTasks, setCompletedTasks] = useState(0)
  const [weakTopics, setWeakTopics] = useState([])
  const [subjectProgress, setSubjectProgress] = useState([])

  const [testCenter, setTestCenter] = useState({
    defaultSettings: { ...DEFAULT_TEST_SETTINGS },
    generatedExams: [],
    activeAttempt: null,
    submittedAttempts: [],
    adaptiveSets: [],
  })

  const [youtubeExplainer, setYoutubeExplainer] = useState({
    jobs: [],
    activeJobId: null,
  })
  const [aiDebug, setAiDebug] = useState({
    planner: null,
    practice: null,
    tests: null,
  })

  const refreshPlannerAndOverview = useCallback(async () => {
    const [planPayload, overviewPayload] = await Promise.all([
      apiRequest('/api/planner/weekly'),
      apiRequest('/api/progress/overview'),
    ])

    const plannerFallbackDebug = formatAiFallbackDebug(
      resolveGenerationDebug(planPayload, 'plan') || null,
      'Planner generation fallback was used',
      resolveGenerationSource(planPayload, 'plan') || 'llm',
    )

    setAiDebug((current) => ({
      ...current,
      planner: plannerFallbackDebug || current.planner,
    }))

    const mappedTasks = (planPayload.plan?.tasks || []).map(mapTask)
    const todayKey = formatDateKey(new Date())
    const enrichedTasks = mappedTasks.map((task) => ({
      ...task,
      displayStatus: mapDisplayStatus(task, todayKey),
    }))

    setTasks(enrichedTasks)
    setRetentionScore(overviewPayload.overview?.retentionScore || 0)
    setTodayPlan(overviewPayload.overview?.dueTodayTasks || 0)
    setOverdueTasks(overviewPayload.overview?.overdueTasks || 0)
    setCompletedTasks(enrichedTasks.filter((task) => task.displayStatus === 'Completed').length)
  }, [])

  const refreshCoverage = useCallback(async () => {
    const payload = await apiRequest('/api/coverage/state')
    const mappedTopics = (payload.state || []).map(mapCoverageTopic)
    setTopics(mappedTopics)
    setSubjectProgress((payload.subjects || []).map(mapSubjectProgress))

    const weak = mappedTopics
      .filter((topic) => !topic.covered || topic.confidence === 'Low')
      .map((topic) => topic.name)
      .slice(0, 8)
    setWeakTopics(weak)
  }, [])

  const refreshSubjectProgress = useCallback(async () => {
    const payload = await apiRequest('/api/progress/subjects')
    setSubjectProgress((payload.subjects || []).map(mapSubjectProgress))
  }, [])

  const refreshGeneratedExams = useCallback(async () => {
    const payload = await apiRequest('/api/tests')
    const mappedExams = (payload.exams || []).map(mapExam)
    setTestCenter((current) => ({
      ...current,
      generatedExams: mappedExams,
    }))
  }, [])

  const refreshLearningState = useCallback(async () => {
    await Promise.all([
      refreshPlannerAndOverview(),
      refreshCoverage(),
      refreshSubjectProgress(),
      refreshGeneratedExams(),
    ])
  }, [refreshCoverage, refreshPlannerAndOverview, refreshSubjectProgress, refreshGeneratedExams])

  useEffect(() => {
    window.localStorage.setItem('devclash-planner-view', plannerView)
  }, [plannerView])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const deferred = window.setTimeout(() => {
      refreshLearningState().catch(() => {})
    }, 0)

    return () => window.clearTimeout(deferred)
  }, [isAuthenticated, refreshLearningState])

  const completeTask = async (taskId) => {
    await apiRequest(`/api/planner/tasks/${taskId}/status`, {
      method: 'POST',
      body: { status: 'completed' },
    })
    await refreshLearningState()
  }

  const skipTask = async (taskId) => {
    await apiRequest(`/api/planner/tasks/${taskId}/status`, {
      method: 'POST',
      body: { status: 'skipped' },
    })
    await refreshLearningState()
  }

  const replanTask = async (_taskId, nextDate) => {
    const payload = await apiRequest('/api/planner/rebalance', {
      method: 'POST',
      body: { date: new Date(`${nextDate}T00:00:00.000Z`).toISOString() },
    })

    setAiDebug((current) => ({
      ...current,
      planner:
        formatAiFallbackDebug(
          resolveGenerationDebug(payload, 'plan'),
          'AI rebalance failed and fallback was used',
          resolveGenerationSource(payload, 'plan'),
        ) || current.planner,
    }))

    await refreshLearningState()
  }

  const setPlannerView = (view) => {
    if (view !== 'list' && view !== 'calendar') return
    setPlannerViewState(view)
  }

  const markTopicCompleted = async (topicId) => {
    await apiRequest('/api/coverage/manual-mark', {
      method: 'POST',
      body: { topicId },
    })
    await refreshCoverage()
  }

  const unmarkTopicCompleted = async (topicId) => {
    await apiRequest('/api/coverage/manual-unmark', {
      method: 'POST',
      body: { topicId },
    })
    await refreshCoverage()
  }

  const clearTopicOverride = async (topicId) => {
    await apiRequest('/api/coverage/manual-reset', {
      method: 'POST',
      body: { topicId },
    })
    await refreshCoverage()
  }

  const incrementRevision = async (topicId) => {
    await apiRequest('/api/coverage/revision-inc', {
      method: 'POST',
      body: { topicId },
    })
    await refreshCoverage()
  }

  const decrementRevision = async (topicId) => {
    await apiRequest('/api/coverage/revision-dec', {
      method: 'POST',
      body: { topicId },
    })
    await refreshCoverage()
  }

  const createGeneratedExam = async (inputSettings) => {
    const payload = await apiRequest('/api/tests/generate', {
      method: 'POST',
      body: inputSettings,
    })

    setAiDebug((current) => ({
      ...current,
      tests: formatAiFallbackDebug(
        resolveGenerationDebug(payload),
        'AI exam generation failed and fallback was used',
        resolveGenerationSource(payload),
      ),
    }))

    const mappedExam = mapExam(payload.exam)

    setTestCenter((current) => ({
      ...current,
      defaultSettings: {
        ...current.defaultSettings,
        ...mappedExam.settings,
      },
      generatedExams: [mappedExam, ...current.generatedExams.filter((item) => item.id !== mappedExam.id)],
    }))

    return mappedExam
  }

  const generateCustomPlan = async ({ goalText, timeframeDays, selectedTopics }) => {
    await apiRequest('/api/planner/generate-custom', {
      method: 'POST',
      body: {
        goalText,
        timeframeDays,
        selectedTopics,
      },
    })

    await refreshPlannerAndOverview()
  }

  const generateWeeklyPlan = async ({ selectedTopicIds = [], weekStart = null, regenerate = false } = {}) => {
    await apiRequest('/api/planner/generate-weekly', {
      method: 'POST',
      body: {
        selectedTopicIds,
        regenerate,
        ...(weekStart ? { weekStart } : {}),
      },
    })

    await refreshPlannerAndOverview()
  }

  const beginExamAttempt = async (examId) => {
    const payload = await apiRequest('/api/tests/start', {
      method: 'POST',
      body: { examId },
    })

    const exam = mapExam(payload.exam)
    const attempt = payload.attempt
    const totalDurationSec = (exam.settings.durationMin || 40) * 60

    const responses = {}
    const confidenceByQuestion = {}
    const timeByQuestion = {}

    ;(attempt.responses || []).forEach((response) => {
      if (response.selectedOptionIndex !== null && response.selectedOptionIndex !== undefined) {
        responses[response.questionId] = response.selectedOptionIndex
      }
      confidenceByQuestion[response.questionId] = toConfidenceLevel(response.confidence || 0.6)
      timeByQuestion[response.questionId] = response.timeSpentSec || 0
    })

    const activeAttempt = {
      id: attempt._id,
      examId: exam.id,
      name: exam.name,
      startedAt: attempt.startedAt,
      status: 'in-progress',
      settings: exam.settings,
      questions: exam.questions,
      totalDurationSec,
      timeLeftSec: Math.max(0, totalDurationSec - (attempt.elapsedSec || 0)),
      responses,
      confidenceByQuestion,
      timeByQuestion,
      autosavedAt: attempt.lastSavedAt,
    }

    setTestCenter((current) => ({
      ...current,
      generatedExams: [exam, ...current.generatedExams.filter((item) => item.id !== exam.id)],
      activeAttempt,
    }))

    return activeAttempt
  }

  const saveExamAttempt = async ({ attemptId, responses, confidenceByQuestion, timeByQuestion, timeLeftSec }) => {
    setTestCenter((current) => {
      if (!current.activeAttempt || current.activeAttempt.id !== attemptId) {
        return current
      }

      return {
        ...current,
        activeAttempt: {
          ...current.activeAttempt,
          responses: responses || current.activeAttempt.responses,
          confidenceByQuestion: confidenceByQuestion || current.activeAttempt.confidenceByQuestion,
          timeByQuestion: timeByQuestion || current.activeAttempt.timeByQuestion,
          timeLeftSec:
            typeof timeLeftSec === 'number' ? Math.max(0, timeLeftSec) : current.activeAttempt.timeLeftSec,
        },
      }
    })

    const currentAttempt = testCenter.activeAttempt
    if (!currentAttempt || currentAttempt.id !== attemptId) {
      return
    }

    const totalDurationSec = currentAttempt.totalDurationSec || 0
    const elapsedSec = Math.max(0, totalDurationSec - (timeLeftSec ?? currentAttempt.timeLeftSec))

    const mergedResponses = currentAttempt.questions.map((question) => {
      const selected = (responses || currentAttempt.responses)[question.id]
      return {
        questionId: question.id,
        selectedOptionIndex: selected === undefined ? null : selected,
        confidence:
          CONFIDENCE_TO_VALUE[(confidenceByQuestion || currentAttempt.confidenceByQuestion)[question.id]] ||
          CONFIDENCE_TO_VALUE.medium,
        timeSpentSec: (timeByQuestion || currentAttempt.timeByQuestion)[question.id] || 0,
      }
    })

    const payload = await apiRequest('/api/tests/save', {
      method: 'POST',
      body: {
        attemptId,
        elapsedSec,
        responses: mergedResponses,
      },
    })

    setTestCenter((current) => {
      if (!current.activeAttempt || current.activeAttempt.id !== attemptId) {
        return current
      }

      return {
        ...current,
        activeAttempt: {
          ...current.activeAttempt,
          autosavedAt: payload.attempt?.lastSavedAt || new Date().toISOString(),
        },
      }
    })
  }

  const submitExamAttempt = async (attemptId, snapshot = {}) => {
    const active = testCenter.activeAttempt
    if (!active || active.id !== attemptId) {
      return null
    }

    const finalResponses = snapshot.responses || active.responses
    const finalConfidence = snapshot.confidenceByQuestion || active.confidenceByQuestion
    const finalTime = snapshot.timeByQuestion || active.timeByQuestion
    const finalTimeLeft =
      typeof snapshot.timeLeftSec === 'number' ? Math.max(0, snapshot.timeLeftSec) : active.timeLeftSec
    const proctoringLogs = Array.isArray(snapshot.proctoringLogs) ? snapshot.proctoringLogs : []

    const elapsedSec = Math.max(0, active.totalDurationSec - finalTimeLeft)

    const responseList = active.questions.map((question) => {
      const selected = finalResponses[question.id]
      return {
        questionId: question.id,
        selectedOptionIndex: selected === undefined ? null : selected,
        confidence: CONFIDENCE_TO_VALUE[finalConfidence[question.id]] || CONFIDENCE_TO_VALUE.medium,
        timeSpentSec: finalTime[question.id] || 0,
      }
    })

    await apiRequest('/api/tests/submit', {
      method: 'POST',
      body: {
        attemptId,
        elapsedSec,
        responses: responseList,
        proctoringLogs,
      },
    })

    const resultPayload = await apiRequest(`/api/tests/result/${attemptId}`)
    const result = resultPayload.result

    const review = (result.review || []).map((item) => ({
      id: item.questionId,
      number: 0,
      topic: item.topicName,
      type: item.type,
      prompt: item.prompt,
      options: item.options,
      selectedIndex: item.selectedOptionIndex,
      correctIndex: item.correctOptionIndex,
      isCorrect: item.isCorrect,
      confidence: toConfidenceLevel(responseList.find((resp) => resp.questionId === item.questionId)?.confidence || 0.6),
      timeSpentSec: responseList.find((resp) => resp.questionId === item.questionId)?.timeSpentSec || 0,
      explanation: item.explanation,
    }))

    review.forEach((item, index) => {
      item.number = index + 1
    })

    const topicBreakdown = mapReviewToTopicBreakdown(review, result.topicBreakdown || [])
    const weak = topicBreakdown
      .filter((topic) => topic.accuracy < 0.65 || topic.avgConfidence !== 'High')
      .map((topic) => topic.topic)

    const report = {
      score: result.score,
      percentage: result.maxScore > 0 ? Math.round((Math.max(0, result.score) / result.maxScore) * 100) : 0,
      correct: result.correctCount,
      incorrect: result.incorrectCount,
      answered: result.correctCount + result.incorrectCount,
      total: review.length,
      topicBreakdown,
      weakTopics: weak,
      review,
    }

    const submission = {
      id: attemptId,
      examId: result.examId,
      submittedAt: result.submittedAt,
      status: 'submitted',
      report,
    }

    setTestCenter((current) => ({
      ...current,
      activeAttempt: null,
      submittedAttempts: [submission, ...current.submittedAttempts.filter((item) => item.id !== submission.id)],
    }))

    return submission
  }

  const generateAdaptivePracticeSet = async () => {
    const payload = await apiRequest('/api/practice/next-set', {
      method: 'POST',
      body: { count: 6 },
    })

    setAiDebug((current) => ({
      ...current,
      practice: formatAiFallbackDebug(
        resolveGenerationDebug(payload, 'set'),
        'AI practice generation failed and fallback was used',
        resolveGenerationSource(payload, 'set'),
      ),
    }))

    const nextSet = payload.set
    const mappedSet = {
      id: createAdaptiveSetId(nextSet.generatedAt),
      sourceAttemptId: null,
      createdAt: nextSet.generatedAt,
      focusTopics: (nextSet.weakTopics || []).map((entry) => entry.topicName),
      questions: (nextSet.questions || []).map((question) => ({
        id: question.questionId,
        prompt: question.prompt,
        rationale: question.whyAssigned,
      })),
    }

    setTestCenter((current) => ({
      ...current,
      adaptiveSets: [mappedSet, ...current.adaptiveSets],
    }))

    return mappedSet
  }

  const getTopicPracticeSet = async ({ topicId, count = 6 }) => {
    const payload = await apiRequest('/api/practice/next-set', {
      method: 'POST',
      body: {
        count,
        includeTopicIds: [topicId],
      },
    })

    setAiDebug((current) => ({
      ...current,
      practice: formatAiFallbackDebug(
        resolveGenerationDebug(payload, 'set'),
        'AI practice generation failed and fallback was used',
        resolveGenerationSource(payload, 'set'),
      ),
    }))

    const nextSet = payload.set

    return {
      id: createAdaptiveSetId(nextSet.generatedAt),
      createdAt: nextSet.generatedAt,
      weakTopics: nextSet.weakTopics || [],
      questions: (nextSet.questions || []).map(mapPracticeQuestion),
    }
  }

  const submitTopicPracticeSession = async ({
    topicId,
    questionCount,
    attemptedCount,
    correctCount,
    totalTimeSec,
    avgConfidence,
  }) => {
    const payload = await apiRequest('/api/practice/submit', {
      method: 'POST',
      body: {
        topicId,
        questionCount,
        attemptedCount,
        correctCount,
        totalTimeSec,
        avgConfidence,
      },
    })

    await refreshLearningState()
    return payload
  }

  const getTopicTestHistory = async (topicId, limit = 12) => {
    const query = new URLSearchParams({
      topicId,
      limit: String(limit),
    })

    const payload = await apiRequest(`/api/tests/history?${query.toString()}`)
    return payload.history || []
  }

  const setYoutubeActiveJob = (jobId) => {
    setYoutubeExplainer((current) => ({
      ...current,
      activeJobId: jobId,
    }))
  }

  const startYoutubeExplainJob = async (url) => {
    const payload = await apiRequest('/api/media/youtube/explain', {
      method: 'POST',
      body: { url },
    })

    const mapped = mapYoutubeJob(payload.job)

    setYoutubeExplainer((current) => ({
      jobs: [mapped, ...current.jobs.filter((job) => job.id !== mapped.id)],
      activeJobId: mapped.id,
    }))

    return mapped
  }

  const setYoutubeJobProgress = () => {}

  const resolveYoutubeJob = async (jobId) => {
    const payload = await apiRequest(`/api/media/youtube/explain/${jobId}`)
    const mapped = mapYoutubeJob(payload.job)

    setYoutubeExplainer((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === mapped.id ? mapped : job)),
      activeJobId: mapped.id,
    }))

    return mapped
  }

  const retryYoutubeJob = async (jobId) => {
    const source = youtubeExplainer.jobs.find((job) => job.id === jobId)
    if (!source) {
      return null
    }

    return startYoutubeExplainJob(source.url)
  }

  const runYoutubeFallback = async () => null

  const calendarGroups = useMemo(() => {
    const buckets = tasks.reduce((acc, task) => {
      if (!acc[task.scheduledDate]) {
        acc[task.scheduledDate] = []
      }

      acc[task.scheduledDate].push(task)
      return acc
    }, {})

    return Object.entries(buckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, groupedTasks]) => ({ date, tasks: groupedTasks }))
  }, [tasks])

  const value = {
    retentionScore,
    plannerView,
    tasks,
    topics,
    subjectProgress,
    todayPlan,
    overdueTasks,
    weakTopics,
    aiDebug,
    completedTasks,
    calendarGroups,
    completeTask,
    skipTask,
    replanTask,
    setPlannerView,
    markTopicCompleted,
    unmarkTopicCompleted,
    clearTopicOverride,
    incrementRevision,
    decrementRevision,
    generateWeeklyPlan,
    generateCustomPlan,
    testDefaultSettings: testCenter.defaultSettings,
    generatedExams: testCenter.generatedExams,
    activeAttempt: testCenter.activeAttempt,
    submittedAttempts: testCenter.submittedAttempts,
    adaptiveSets: testCenter.adaptiveSets,
    createGeneratedExam,
    beginExamAttempt,
    saveExamAttempt,
    submitExamAttempt,
    generateAdaptivePracticeSet,
    getTopicPracticeSet,
    submitTopicPracticeSession,
    getTopicTestHistory,
    youtubeJobs: youtubeExplainer.jobs,
    activeYoutubeJobId: youtubeExplainer.activeJobId,
    startYoutubeExplainJob,
    setYoutubeActiveJob,
    setYoutubeJobProgress,
    resolveYoutubeJob,
    retryYoutubeJob,
    runYoutubeFallback,
  }

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
}

export function useLearning() {
  const context = useContext(LearningContext)

  if (!context) {
    throw new Error('useLearning must be used inside LearningProvider')
  }

  return context
}

export default LearningProvider
