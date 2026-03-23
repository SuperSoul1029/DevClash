import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Chip from '../components/ui/Chip.jsx'
import Badge from '../components/ui/Badge.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import * as tf from '@tensorflow/tfjs'
import * as blazeface from '@tensorflow-models/blazeface'
import { useLearning } from '../context/LearningContext.jsx'

function formatDateTime(isoDate) {
  if (!isoDate) return 'Not saved yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function confidenceTone(confidence) {
  if (confidence === 'high') return 'success'
  if (confidence === 'low') return 'alert'
  return 'brand'
}

function typeLabel(type) {
  if (type === 'trueFalse') return 'True / False'
  if (type === 'caseStudy') return 'Case Study'
  return 'MCQ'
}

function statusBadge(status) {
  if (status === 'submitted') return 'success'
  if (status === 'in-progress') return 'warning'
  return 'info'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

const PROCTORING_INTERVAL_MS = 1000
const LOOK_AWAY_THRESHOLD_MS = 3000
const PROCTORING_LOG_COOLDOWN_MS = 8000
let blazeFaceDetectorPromise = null

async function createFaceDetector() {
  if (typeof window === 'undefined' || !('FaceDetector' in window)) {
    if (!blazeFaceDetectorPromise) {
      blazeFaceDetectorPromise = (async () => {
        await tf.ready()

        const model = await blazeface.load()
        return {
          mode: 'blazeface',
          detect: async (videoElement) => {
            const predictions = await model.estimateFaces(videoElement, false)
            return predictions.map((face) => {
              const [x1, y1] = face.topLeft
              const [x2, y2] = face.bottomRight
              return {
                boundingBox: {
                  x: x1,
                  y: y1,
                  width: x2 - x1,
                  height: y2 - y1,
                },
              }
            })
          },
        }
      })().catch(() => null)
    }

    return blazeFaceDetectorPromise
  }

  try {
    const nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 })
    return {
      mode: 'face_detector',
      detect: (videoElement) => nativeDetector.detect(videoElement),
    }
  } catch {
    return null
  }
}

function nowIso() {
  return new Date().toISOString()
}

const EXAM_COLUMNS = [
  { key: 'name', header: 'Generated Exam' },
  { key: 'difficulty', header: 'Difficulty' },
  { key: 'count', header: 'Questions' },
  { key: 'duration', header: 'Duration' },
  { key: 'topics', header: 'Topics' },
  { key: 'actions', header: 'Action' },
]

const REPORT_COLUMNS = [
  { key: 'topic', header: 'Topic' },
  { key: 'attempted', header: 'Attempted' },
  { key: 'correct', header: 'Correct' },
  { key: 'accuracy', header: 'Accuracy' },
  { key: 'confidence', header: 'Avg Confidence' },
  { key: 'time', header: 'Time (min)' },
]

function TestCenterPage() {
  const {
    topics,
    aiDebug,
    testDefaultSettings,
    generatedExams,
    activeAttempt,
    submittedAttempts,
    createGeneratedExam,
    beginExamAttempt,
    saveExamAttempt,
    submitExamAttempt,
  } = useLearning()

  const [form, setForm] = useState(() => ({
    ...testDefaultSettings,
    includeTopics: [],
    excludeTopics: [],
    typeMix: { ...testDefaultSettings.typeMix },
    negativeMarking: { ...testDefaultSettings.negativeMarking },
  }))
  const [topicDraft, setTopicDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [attemptState, setAttemptState] = useState(() => {
    if (!activeAttempt) return null
    return {
      id: activeAttempt.id,
      responses: { ...(activeAttempt.responses ?? {}) },
      confidenceByQuestion: { ...(activeAttempt.confidenceByQuestion ?? {}) },
      timeByQuestion: { ...(activeAttempt.timeByQuestion ?? {}) },
      timeLeftSec: activeAttempt.timeLeftSec,
      previousQuestionId: activeAttempt.questions[0]?.id ?? null,
    }
  })
  const [activeIndex, setActiveIndex] = useState(0)
  const [proctoringPermission, setProctoringPermission] = useState('pending')
  const [multipleFaceAlert, setMultipleFaceAlert] = useState({
    open: false,
    faceCount: 0,
    timestamp: null,
  })
  const activeAttemptId = activeAttempt?.id || null
  const activeAttemptIdRef = useRef(activeAttemptId)
  const proctoringLogsRef = useRef([])
  const proctoringRuntimeRef = useRef({
    stream: null,
    video: null,
    detector: null,
    intervalId: null,
    lookAwayStartedAt: null,
    lastLookAwayLoggedAt: 0,
    lastMultipleFaceLoggedAt: 0,
    detectionUnavailableLogged: false,
  })

  const appendProctoringLog = useCallback((type, details = {}) => {
    proctoringLogsRef.current = [
      ...proctoringLogsRef.current,
      {
        attemptId: activeAttemptIdRef.current,
        type,
        timestamp: nowIso(),
        details,
      },
    ]
  }, [])

  const stopProctoring = useCallback((reason = null) => {
    const runtime = proctoringRuntimeRef.current
    if (runtime.intervalId) {
      window.clearInterval(runtime.intervalId)
      runtime.intervalId = null
    }

    if (runtime.stream) {
      runtime.stream.getTracks().forEach((track) => track.stop())
      runtime.stream = null
    }

    if (runtime.video) {
      runtime.video.pause()
      runtime.video.srcObject = null
      runtime.video = null
    }

    runtime.detector = null
    runtime.lookAwayStartedAt = null
    runtime.lastLookAwayLoggedAt = 0
    runtime.lastMultipleFaceLoggedAt = 0
    runtime.detectionUnavailableLogged = false

    if (reason && activeAttemptIdRef.current) {
      appendProctoringLog('proctoring_stopped', { reason })
    }
  }, [appendProctoringLog])

  const startProctoring = async () => {
    if (!activeAttempt) return

    if (!navigator.mediaDevices?.getUserMedia) {
      setProctoringPermission('unsupported')
      appendProctoringLog('proctoring_not_supported', { reason: 'camera_api_unavailable' })
      return
    }

    setProctoringPermission('requesting')
    stopProctoring()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })

      const video = document.createElement('video')
      video.playsInline = true
      video.muted = true
      video.srcObject = stream
      await video.play()

      const detector = await createFaceDetector()
      const runtime = proctoringRuntimeRef.current
      runtime.stream = stream
      runtime.video = video
      runtime.detector = detector

      appendProctoringLog('proctoring_started', {
        detector: detector?.mode || 'none',
      })

      const intervalId = window.setInterval(async () => {
        if (!runtime.video) return

        if (!runtime.detector) {
          if (!runtime.detectionUnavailableLogged) {
            appendProctoringLog('proctoring_detection_unavailable', {
              reason: 'face_detector_not_supported',
            })
            runtime.detectionUnavailableLogged = true
          }
          return
        }

        try {
          const faces = await runtime.detector.detect(runtime.video)
          const currentTime = Date.now()

          if (faces.length > 1 && currentTime - runtime.lastMultipleFaceLoggedAt >= PROCTORING_LOG_COOLDOWN_MS) {
            appendProctoringLog('second_face_detected', {
              faceCount: faces.length,
            })
            setMultipleFaceAlert({
              open: true,
              faceCount: faces.length,
              timestamp: nowIso(),
            })
            runtime.lastMultipleFaceLoggedAt = currentTime
          }

          const primaryFace = faces[0]
          let lookingAway = !primaryFace

          if (primaryFace?.boundingBox && runtime.video.videoWidth && runtime.video.videoHeight) {
            const centerX = primaryFace.boundingBox.x + primaryFace.boundingBox.width / 2
            const centerRatio = centerX / runtime.video.videoWidth
            if (centerRatio < 0.2 || centerRatio > 0.8) {
              lookingAway = true
            }
          }

          if (lookingAway) {
            if (!runtime.lookAwayStartedAt) {
              runtime.lookAwayStartedAt = currentTime
            }

            const lookAwayMs = currentTime - runtime.lookAwayStartedAt
            if (lookAwayMs >= LOOK_AWAY_THRESHOLD_MS && currentTime - runtime.lastLookAwayLoggedAt >= PROCTORING_LOG_COOLDOWN_MS) {
              appendProctoringLog('look_away_over_3s', {
                durationMs: lookAwayMs,
              })
              runtime.lastLookAwayLoggedAt = currentTime
            }
          } else {
            runtime.lookAwayStartedAt = null
          }
        } catch (error) {
          appendProctoringLog('proctoring_detection_error', {
            message: error?.message || 'Detection failed',
          })
        }
      }, PROCTORING_INTERVAL_MS)

      runtime.intervalId = intervalId
      setProctoringPermission('granted')
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
      setProctoringPermission(denied ? 'denied' : 'error')
      appendProctoringLog('proctoring_permission_failed', {
        denied,
        message: error?.message || 'Camera permission failed',
      })
      stopProctoring()
    }
  }

  useEffect(() => {
    activeAttemptIdRef.current = activeAttemptId
  }, [activeAttemptId])

  useEffect(() => {
    if (!activeAttemptId) {
      stopProctoring('attempt_not_running')
      setProctoringPermission('pending')
      proctoringLogsRef.current = []
      setMultipleFaceAlert({ open: false, faceCount: 0, timestamp: null })
      return
    }

    setProctoringPermission('pending')
    proctoringLogsRef.current = []
    setMultipleFaceAlert({ open: false, faceCount: 0, timestamp: null })

    return () => {
      stopProctoring('attempt_changed')
    }
  }, [activeAttemptId, stopProctoring])

  useEffect(() => {
    return () => {
      stopProctoring('workspace_unmounted')
    }
  }, [stopProctoring])

  useEffect(() => {
    if (!attemptState || !activeAttempt) return

    const timer = window.setInterval(() => {
      setAttemptState((current) => {
        if (!current) return current
        const nextTime = Math.max(0, current.timeLeftSec - 1)
        if (nextTime !== current.timeLeftSec) {
          return {
            ...current,
            timeLeftSec: nextTime,
          }
        }
        return current
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [attemptState, activeAttempt])

  useEffect(() => {
    if (!attemptState || !activeAttempt) return

    const autosave = window.setInterval(() => {
      saveExamAttempt({
        attemptId: attemptState.id,
        responses: attemptState.responses,
        confidenceByQuestion: attemptState.confidenceByQuestion,
        timeByQuestion: attemptState.timeByQuestion,
        timeLeftSec: attemptState.timeLeftSec,
      })
    }, 5000)

    return () => window.clearInterval(autosave)
  }, [attemptState, activeAttempt, saveExamAttempt])

  const availableTopics = topics.map((topic) => topic.name)

  const typeMixTotal =
    Number(form.typeMix.mcq) +
    Number(form.typeMix.trueFalse) +
    Number(form.typeMix.caseStudy)

  const effectiveMix = useMemo(() => {
    if (typeMixTotal <= 0) {
      return { mcq: 50, trueFalse: 25, caseStudy: 25 }
    }
    return {
      mcq: Math.round((Number(form.typeMix.mcq) / typeMixTotal) * 100),
      trueFalse: Math.round((Number(form.typeMix.trueFalse) / typeMixTotal) * 100),
      caseStudy: Math.round((Number(form.typeMix.caseStudy) / typeMixTotal) * 100),
    }
  }, [form.typeMix, typeMixTotal])

  const startExam = async (examId) => {
    const started = await beginExamAttempt(examId)
    if (!started) return

    setAttemptState({
      id: started.id,
      responses: { ...(started.responses ?? {}) },
      confidenceByQuestion: { ...(started.confidenceByQuestion ?? {}) },
      timeByQuestion: { ...(started.timeByQuestion ?? {}) },
      timeLeftSec: started.timeLeftSec,
      previousQuestionId: started.questions[0]?.id ?? null,
    })
    setActiveIndex(0)
  }

  const generatedRows = generatedExams.map((exam) => ({
    id: exam.id,
    name: exam.name,
    difficulty: exam.settings.difficulty,
    count: exam.settings.questionCount,
    duration: `${exam.settings.durationMin} min`,
    topics: exam.blueprint.topics.join(', '),
    actions: (
      <Button variant="ghost" onClick={() => startExam(exam.id)}>
        Start Attempt
      </Button>
    ),
  }))

  const latestSubmission = submittedAttempts[0] ?? null
  const question = activeAttempt?.questions?.[activeIndex]

  const switchQuestion = (nextIndex) => {
    if (!attemptState || !activeAttempt) return

    const bounded = clamp(nextIndex, 0, activeAttempt.questions.length - 1)
    const elapsedSec = 15

    const outgoingQuestion = activeAttempt.questions[activeIndex]
    if (outgoingQuestion) {
      setAttemptState((current) => ({
        ...current,
        timeByQuestion: {
          ...current.timeByQuestion,
          [outgoingQuestion.id]: (current.timeByQuestion[outgoingQuestion.id] ?? 0) + elapsedSec,
        },
        previousQuestionId: activeAttempt.questions[bounded]?.id ?? outgoingQuestion.id,
      }))
    }

    setActiveIndex(bounded)
  }

  const updateAnswer = (questionId, optionIndex) => {
    setAttemptState((current) => ({
      ...current,
      responses: {
        ...current.responses,
        [questionId]: optionIndex,
      },
    }))
  }

  const updateConfidence = (questionId, level) => {
    setAttemptState((current) => ({
      ...current,
      confidenceByQuestion: {
        ...current.confidenceByQuestion,
        [questionId]: level,
      },
    }))
  }

  const addTopicToList = () => {
    if (!topicDraft) return

    setForm((current) => {
      if (current.includeTopics.includes(topicDraft)) {
        return current
      }

      return {
        ...current,
        includeTopics: [...current.includeTopics, topicDraft],
      }
    })

    setTopicDraft('')
  }

  const removeTopicFromList = (topicName) => {
    setForm((current) => ({
      ...current,
      includeTopics: current.includeTopics.filter((topic) => topic !== topicName),
    }))
  }

  const submitCurrentAttempt = async () => {
    if (!attemptState || !activeAttempt) return

    const proctoringLogs = [...proctoringLogsRef.current]
    stopProctoring('attempt_submitted')

    const submission = await submitExamAttempt(attemptState.id, {
      responses: attemptState.responses,
      confidenceByQuestion: attemptState.confidenceByQuestion,
      timeByQuestion: attemptState.timeByQuestion,
      timeLeftSec: attemptState.timeLeftSec,
      proctoringLogs,
    })

    if (submission) {
      setAttemptState(null)
      setActiveIndex(0)
    }
  }

  const totalQuestions = activeAttempt?.questions.length ?? 0
  const answeredCount = attemptState
    ? Object.values(attemptState.responses).filter((value) => value !== undefined).length
    : 0

  return (
    <div className="page-grid">
      <Modal
        open={multipleFaceAlert.open && Boolean(activeAttemptId)}
        title="Multiple Face Detected"
        onClose={() =>
          setMultipleFaceAlert((current) => ({
            ...current,
            open: false,
          }))
        }
      >
        <p className="muted-copy">
          Multiple face detected during test attempt.
          {multipleFaceAlert.faceCount > 0 ? ` Faces detected: ${multipleFaceAlert.faceCount}.` : ''}
        </p>
        {multipleFaceAlert.timestamp ? (
          <p className="muted-copy">Detected at: {formatDateTime(multipleFaceAlert.timestamp)}</p>
        ) : null}
      </Modal>

      <h1 className="topic-tracker-title">Test Center</h1>
      {aiDebug?.tests ? (
        <p className="debug-error-text">Test Generation AI fallback: {aiDebug.tests}</p>
      ) : null}
      {aiDebug?.practice ? (
        <p className="debug-error-text">Practice AI fallback: {aiDebug.practice}</p>
      ) : null}

      <section>
        <Card
          title="Generator Controls"
          subtitle="Difficulty, count, duration, type mix, topics list, and negative marking"
          action={<Badge status="info">Phase F3</Badge>}
        >
          <div className="form-grid test-form-grid">
            <label>
              Difficulty
              <select
                value={form.difficulty}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    difficulty: event.target.value,
                  }))
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>

            <label>
              Question Count
              <input
                type="number"
                min="5"
                max="40"
                value={form.questionCount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    questionCount: clamp(Number(event.target.value) || 5, 5, 40),
                  }))
                }
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="10"
                max="180"
                value={form.durationMin}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    durationMin: clamp(Number(event.target.value) || 10, 10, 180),
                  }))
                }
              />
            </label>

            <fieldset className="mix-fieldset">
              <legend>Question Type Mix (%)</legend>
              <label>
                MCQ
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.typeMix.mcq}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      typeMix: {
                        ...current.typeMix,
                        mcq: clamp(Number(event.target.value) || 0, 0, 100),
                      },
                    }))
                  }
                />
              </label>
              <label>
                True/False
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.typeMix.trueFalse}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      typeMix: {
                        ...current.typeMix,
                        trueFalse: clamp(Number(event.target.value) || 0, 0, 100),
                      },
                    }))
                  }
                />
              </label>
              <label>
                Case Study
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.typeMix.caseStudy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      typeMix: {
                        ...current.typeMix,
                        caseStudy: clamp(Number(event.target.value) || 0, 0, 100),
                      },
                    }))
                  }
                />
              </label>
            </fieldset>

            <fieldset className="topic-include-picker test-form-grid__full">
              <legend>Topics List</legend>

              <div className="topic-include-list" role="list" aria-label="Included topics list">
                {!form.includeTopics.length ? (
                  <p className="muted-copy">No topics added yet. Empty list uses all topics.</p>
                ) : null}

                {form.includeTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    className="topic-include-pill"
                    onClick={() => removeTopicFromList(topic)}
                    aria-label={`Remove ${topic} from topics list`}
                  >
                    <span className="topic-include-pill__mark" aria-hidden="true">x</span>
                    <span>{topic}</span>
                  </button>
                ))}
              </div>

              <div className="topic-include-controls">
                <select
                  value={topicDraft}
                  onChange={(event) => setTopicDraft(event.target.value)}
                  aria-label="Select topic to add"
                >
                  <option value="">Select topic</option>
                  {availableTopics
                    .filter((topic) => !form.includeTopics.includes(topic))
                    .map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                </select>
                <Button type="button" variant="ghost" onClick={addTopicToList} disabled={!topicDraft}>
                  Add Topic
                </Button>
              </div>
            </fieldset>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.negativeMarking.enabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    negativeMarking: {
                      ...current.negativeMarking,
                      enabled: event.target.checked,
                    },
                  }))
                }
              />
              Enable Negative Marking
            </label>

            {form.negativeMarking.enabled ? (
              <label>
                Negative Mark Value
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.negativeMarking.value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      negativeMarking: {
                        ...current.negativeMarking,
                        value: clamp(Number(event.target.value) || 0, 0, 1),
                      },
                    }))
                  }
                />
              </label>
            ) : null}

            {error && <p className="form-error mb-4">{error}</p>}

            <Button
              disabled={generating}
              onClick={async () => {
                setGenerating(true)
                setError(null)
                try {
                  await createGeneratedExam({
                    ...form,
                    excludeTopics: [],
                    typeMix: effectiveMix,
                  })
                } catch (err) {
                  setError(err.message || 'Failed to generate exam')
                } finally {
                  setGenerating(false)
                }
              }}
            >
              {generating ? 'Generating...' : 'Generate Exam'}
            </Button>
          </div>
        </Card>
      </section>

      <Card title="Generated Exams" subtitle="Create variants and launch attempt sessions">
        <DataTable
          columns={EXAM_COLUMNS}
          rows={generatedRows}
          emptyMessage="No generated exams yet. Build one from the control panel."
        />
      </Card>

      {activeAttempt && attemptState ? (
        <Card
          title="Exam Attempt Workspace"
          subtitle="Timer and autosave are live. Signals are captured per question."
          action={<Badge status="warning">In Progress</Badge>}
        >
          <div className="page-grid">
            {proctoringPermission !== 'granted' ? (
              <Card
                title="Proctoring Permission"
                subtitle="Camera access is required before gaze checks start. Video is processed locally and not shown on screen."
              >
                <div className="inline-actions">
                  <Button
                    variant="ghost"
                    onClick={startProctoring}
                    disabled={proctoringPermission === 'requesting'}
                  >
                    {proctoringPermission === 'requesting'
                      ? 'Requesting Permission...'
                      : 'Allow Camera Proctoring'}
                  </Button>
                </div>
                {proctoringPermission === 'denied' ? (
                  <p className="form-error">Camera permission was denied. Allow access to enable gaze checks.</p>
                ) : null}
                {proctoringPermission === 'unsupported' ? (
                  <p className="form-error">This browser does not support required camera APIs for proctoring.</p>
                ) : null}
                {proctoringPermission === 'error' ? (
                  <p className="form-error">Unable to start proctoring. Try granting camera access again.</p>
                ) : null}
              </Card>
            ) : null}

            <div className="chip-row">
              <Chip tone="brand">Timer: {formatTimer(attemptState.timeLeftSec)}</Chip>
              <Chip tone="neutral">Answered: {answeredCount}/{totalQuestions}</Chip>
              <Chip tone="neutral">Question: {activeIndex + 1}/{totalQuestions}</Chip>
              <Chip tone="success">
                Autosave: {formatDateTime(activeAttempt.autosavedAt || activeAttempt.startedAt)}
              </Chip>
            </div>

            {question ? (
              <article className="attempt-question-card">
                <p className="eyebrow">{typeLabel(question.type)} · {question.topic}</p>
                <h3>{question.prompt}</h3>
                <div className="attempt-options">
                  {question.options.map((option, index) => {
                    const selected = attemptState.responses[question.id] === index
                    return (
                      <button
                        key={`${question.id}-${index}`}
                        type="button"
                        className={`attempt-option ${selected ? 'attempt-option--selected' : ''}`.trim()}
                        onClick={() => updateAnswer(question.id, index)}
                      >
                        <span>{String.fromCharCode(65 + index)}.</span> {option}
                      </button>
                    )
                  })}
                </div>
                <div className="chip-row">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`confidence-pill ${
                        attemptState.confidenceByQuestion[question.id] === level
                          ? 'confidence-pill--active'
                          : ''
                      }`.trim()}
                      onClick={() => updateConfidence(question.id, level)}
                    >
                      <Chip tone={confidenceTone(level)}>
                        Confidence {level}
                      </Chip>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            <div className="inline-actions">
              <Button variant="ghost" onClick={() => switchQuestion(activeIndex - 1)}>
                Previous
              </Button>
              <Button variant="ghost" onClick={() => switchQuestion(activeIndex + 1)}>
                Next
              </Button>
              <Button variant="ghost" onClick={submitCurrentAttempt}>
                Submit Attempt
              </Button>
            </div>
            {attemptState.timeLeftSec === 0 ? (
              <p className="form-error">
                Time is over. Submit now to unlock your report and answer key.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {latestSubmission ? (
        <Card
          title="Post-Submit Report"
          subtitle="Score, topic analytics, answer key, and explanations are visible only after submission"
          action={
            <Badge status={statusBadge(latestSubmission.status)}>
              {latestSubmission.status}
            </Badge>
          }
        >
          <div className="page-grid">
            <div className="chip-row">
              <Chip tone="success">Score: {latestSubmission.report.score}</Chip>
              <Chip tone="brand">Percent: {latestSubmission.report.percentage}%</Chip>
              <Chip tone="neutral">
                Correct {latestSubmission.report.correct}/{latestSubmission.report.total}
              </Chip>
              <Chip tone="alert">Incorrect: {latestSubmission.report.incorrect}</Chip>
            </div>

            <DataTable
              columns={REPORT_COLUMNS}
              rows={latestSubmission.report.topicBreakdown.map((topic) => ({
                id: topic.topic,
                topic: topic.topic,
                attempted: topic.attempted,
                correct: topic.correct,
                accuracy: topic.accuracyLabel,
                confidence: topic.avgConfidence,
                time: topic.timeSpentMin,
              }))}
            />

            <Card
              title="Answer Key and Explanations"
              subtitle="Locked pre-submit, now revealed for review"
            >
              <div className="review-list">
                {latestSubmission.report.review.map((item) => (
                  <article key={item.id} className="review-item">
                    <div className="chip-row">
                      <Chip tone={item.isCorrect ? 'success' : 'alert'}>
                        Q{item.number} {item.isCorrect ? 'Correct' : 'Incorrect'}
                      </Chip>
                      <Chip tone="neutral">{item.topic}</Chip>
                      <Chip tone="neutral">Confidence {item.confidence}</Chip>
                    </div>
                    <p className="review-prompt">{item.prompt}</p>
                    <p>
                      Your answer: {item.selectedIndex !== undefined
                        ? item.options[item.selectedIndex]
                        : 'Not answered'}
                    </p>
                    <p>Correct answer: {item.options[item.correctIndex]}</p>
                    <p className="muted-copy">Explanation: {item.explanation}</p>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

export default TestCenterPage
