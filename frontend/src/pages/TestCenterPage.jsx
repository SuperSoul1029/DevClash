import { useEffect, useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Chip from '../components/ui/Chip.jsx'
import Badge from '../components/ui/Badge.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Button from '../components/ui/Button.jsx'
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
    weakTopics,
    aiDebug,
    testDefaultSettings,
    generatedExams,
    activeAttempt,
    submittedAttempts,
    adaptiveSets,
    createGeneratedExam,
    beginExamAttempt,
    saveExamAttempt,
    submitExamAttempt,
    generateAdaptivePracticeSet,
  } = useLearning()

  const [form, setForm] = useState(() => ({
    ...testDefaultSettings,
    typeMix: { ...testDefaultSettings.typeMix },
    negativeMarking: { ...testDefaultSettings.negativeMarking },
  }))
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

  const selectedTopics = useMemo(() => {
    const include = form.includeTopics.length ? form.includeTopics : availableTopics
    const excluded = new Set(form.excludeTopics)
    const resolved = include.filter((topic) => !excluded.has(topic))
    return resolved.length ? resolved : availableTopics
  }, [form.includeTopics, form.excludeTopics, availableTopics])

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

  const submitCurrentAttempt = async () => {
    if (!attemptState || !activeAttempt) return

    const submission = await submitExamAttempt(attemptState.id, {
      responses: attemptState.responses,
      confidenceByQuestion: attemptState.confidenceByQuestion,
      timeByQuestion: attemptState.timeByQuestion,
      timeLeftSec: attemptState.timeLeftSec,
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
      <section className="hero-panel">
        <p className="eyebrow">Test Center</p>
        <h1>Adaptive Test Generation and Exam Lifecycle</h1>
        <p>
          Configure exam constraints, attempt with timer and autosave, then review
          score, answer key, explanations, and targeted next-question recommendations.
        </p>
        {aiDebug?.tests ? (
          <p className="debug-error-text">Test Generation AI fallback: {aiDebug.tests}</p>
        ) : null}
        {aiDebug?.practice ? (
          <p className="debug-error-text">Practice AI fallback: {aiDebug.practice}</p>
        ) : null}
      </section>

      <section className="split-grid">
        <Card
          title="Generator Controls"
          subtitle="Difficulty, count, duration, type mix, topic include/exclude, and negative marking"
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

            <label>
              Include Topics (hold Ctrl/Cmd for multi-select)
              <select
                multiple
                value={form.includeTopics}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    includeTopics: Array.from(event.target.selectedOptions, (option) => option.value),
                  }))
                }
              >
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Exclude Topics (hold Ctrl/Cmd for multi-select)
              <select
                multiple
                value={form.excludeTopics}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    excludeTopics: Array.from(event.target.selectedOptions, (option) => option.value),
                  }))
                }
              >
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>

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

            <label>
              Negative Mark Value
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                disabled={!form.negativeMarking.enabled}
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

            {error && <p className="form-error mb-4">{error}</p>}

            <Button
              disabled={generating}
              onClick={async () => {
                setGenerating(true)
                setError(null)
                try {
                  await createGeneratedExam({
                    ...form,
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

        <Card title="Blueprint Preview" subtitle="Exam output should shift as controls change">
          <div className="chip-row">
            <Chip tone="brand">Questions: {form.questionCount}</Chip>
            <Chip tone="brand">Duration: {form.durationMin} min</Chip>
            <Chip tone="neutral">MCQ {effectiveMix.mcq}%</Chip>
            <Chip tone="neutral">T/F {effectiveMix.trueFalse}%</Chip>
            <Chip tone="neutral">Case {effectiveMix.caseStudy}%</Chip>
            <Chip tone={form.negativeMarking.enabled ? 'alert' : 'success'}>
              {form.negativeMarking.enabled
                ? `Negative ${form.negativeMarking.value}`
                : 'No Negative Marking'}
            </Chip>
          </div>
          <p className="muted-copy test-preview-copy">
            Selected topics: {selectedTopics.join(', ')}
          </p>
          <p className="muted-copy test-preview-copy">
            Live weak-topic signals from learning state: {weakTopics.join(', ') || 'None'}
          </p>
          <p className="muted-copy test-preview-copy">
            Policy: Answer key and explanations stay hidden during attempt and reveal only after submit.
          </p>
        </Card>
      </section>

      <Card title="Generated Exams" subtitle="Create variants and launch attempt sessions">
        <DataTable
          columns={EXAM_COLUMNS}
          rows={generatedRows}
          emptyMessage="No generated exams yet. Build one from the control panel."
        />
      </Card>

      <Card
        title="Exam Attempt Workspace"
        subtitle={
          activeAttempt
            ? 'Timer and autosave are live. Signals are captured per question.'
            : 'Start an exam to begin the timed attempt.'
        }
        action={
          activeAttempt ? <Badge status="warning">In Progress</Badge> : <Badge status="info">Idle</Badge>
        }
      >
        {!activeAttempt || !attemptState ? (
          <p className="empty-copy">No active test session yet.</p>
        ) : (
          <div className="page-grid">
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
        )}
      </Card>

      <Card
        title="Post-Submit Report"
        subtitle="Score, topic analytics, answer key, and explanations are visible only after submission"
        action={
          latestSubmission ? (
            <Badge status={statusBadge(latestSubmission.status)}>
              {latestSubmission.status}
            </Badge>
          ) : (
            <Badge status="info">No Submission</Badge>
          )
        }
      >
        {!latestSubmission ? (
          <p className="empty-copy">
            Submit a test attempt to unlock answer key, explanations, and topic-level feedback.
          </p>
        ) : (
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

            <div className="inline-actions">
              <Button
                variant="ghost"
                onClick={async () => {
                  const set = await generateAdaptivePracticeSet(latestSubmission.id)
                  if (set) {
                    return
                  }
                }}
              >
                Generate Adaptive Next Set
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Adaptive Practice Recommendations"
        subtitle="Next sets shift toward weaker concepts and explain why assigned"
      >
        {!adaptiveSets.length ? (
          <p className="empty-copy">No targeted set generated yet.</p>
        ) : (
          <div className="review-list">
            {adaptiveSets.map((set) => (
              <article key={set.id} className="review-item">
                <div className="chip-row">
                  <Chip tone="brand">Set {set.id.slice(-6)}</Chip>
                  {set.focusTopics.map((topic) => (
                    <Chip key={`${set.id}-${topic}`} tone="alert">
                      {topic}
                    </Chip>
                  ))}
                </div>
                <p className="muted-copy">Generated {formatDateTime(set.createdAt)}</p>
                <div className="review-list">
                  {set.questions.slice(0, 4).map((question, index) => (
                    <div key={question.id} className="review-item">
                      <p className="review-prompt">
                        {index + 1}. {question.prompt}
                      </p>
                      <p className="muted-copy">Why assigned: {question.rationale}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default TestCenterPage
