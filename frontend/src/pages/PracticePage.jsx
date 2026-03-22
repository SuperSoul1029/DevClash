import { useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Chip from '../components/ui/Chip.jsx'
import Button from '../components/ui/Button.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Modal from '../components/ui/Modal.jsx'
import { useLearning } from '../context/LearningContext.jsx'

const CONFIDENCE_VALUES = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
}

const RESULT_COLUMNS = [
  { key: 'question', header: 'Question' },
  { key: 'selected', header: 'Your Answer' },
  { key: 'correct', header: 'Correct Answer' },
  { key: 'status', header: 'Result' },
  { key: 'topic', header: 'Topic' },
]

const HISTORY_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'attempted', header: 'Attempted' },
  { key: 'correct', header: 'Correct' },
  { key: 'accuracy', header: 'Accuracy' },
  { key: 'score', header: 'Overall Score' },
]

const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Mathematics']

function normalizeSubjectLabel(topic) {
  const nameLabel = String(topic.subjectName || '').toLowerCase()
  const codeLabel = String(topic.subjectCode || '').toLowerCase()
  const topicLabel = String(topic.name || '').toLowerCase()
  const subjectLabel = `${nameLabel} ${codeLabel}`

  if (/(\bphy\b|physics)/.test(subjectLabel)) return 'Physics'
  if (/(\bche\b|chemistry|chemical)/.test(subjectLabel)) return 'Chemistry'
  if (/(\bmth\b|math|mathematics)/.test(subjectLabel)) return 'Mathematics'

  if (/(newton|motion|work|energy|waves|optics|mechanics|gravitation|thermo)/.test(topicLabel)) {
    return 'Physics'
  }
  if (/(atomic|bonding|mole|stoichi|organic|inorganic|electrochem|equilibrium)/.test(topicLabel)) {
    return 'Chemistry'
  }
  if (/(algebra|calculus|geometry|probability|matrix|determinant|trigon)/.test(topicLabel)) {
    return 'Mathematics'
  }

  return 'Mathematics'
}

function formatDateTime(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function resolveCorrectOptionIndex(question) {
  if (question.type === 'trueFalse') {
    const falseIndex = question.options.findIndex((option) => String(option).toLowerCase() === 'false')
    return falseIndex >= 0 ? falseIndex : 1
  }

  const bestOption = question.options.findIndex((option) =>
    /review recent mistakes|targeted practice and review error patterns/i.test(String(option)),
  )

  return bestOption >= 0 ? bestOption : 1
}

function PracticePage() {
  const { topics, getTopicPracticeSet, submitTopicPracticeSession, getTopicTestHistory } = useLearning()
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [questionCount, setQuestionCount] = useState(6)
  const [practiceSet, setPracticeSet] = useState(null)
  const [answers, setAnswers] = useState({})
  const [confidenceByQuestion, setConfidenceByQuestion] = useState({})
  const [result, setResult] = useState(null)
  const [startedAtMs, setStartedAtMs] = useState(0)
  const [loadingSet, setLoadingSet] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTopic, setHistoryTopic] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [topics, selectedTopicId],
  )

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value !== null && value !== undefined).length,
    [answers],
  )

  const groupedTopics = useMemo(() => {
    const groups = {
      Physics: [],
      Chemistry: [],
      Mathematics: [],
    }

    topics.forEach((topic) => {
      const group = normalizeSubjectLabel(topic)
      groups[group].push(topic)
    })

    return groups
  }, [topics])

  const generateSetForTopic = async (topicId) => {
    setSelectedTopicId(topicId)
    setErrorMessage('')
    setResult(null)
    setLoadingSet(true)

    try {
      const nextSet = await getTopicPracticeSet({
        topicId,
        count: questionCount,
      })

      setPracticeSet(nextSet)
      setAnswers({})
      setConfidenceByQuestion(
        Object.fromEntries((nextSet.questions || []).map((question) => [question.id, 'medium'])),
      )
      setStartedAtMs(Date.now())
    } catch (error) {
      setErrorMessage(error.message || 'Unable to generate practice set right now.')
    } finally {
      setLoadingSet(false)
    }
  }

  const openHistoryForTopic = async (topic) => {
    setHistoryTopic(topic)
    setHistoryOpen(true)
    setHistoryLoading(true)

    try {
      const history = await getTopicTestHistory(topic.id, 12)
      const rows = history.map((entry) => ({
        id: entry.attemptId,
        date: formatDateTime(entry.submittedAt),
        attempted: entry.topic?.attempted ?? 0,
        correct: entry.topic?.correct ?? 0,
        accuracy: `${Math.round((entry.topic?.accuracy || 0) * 100)}%`,
        score: `${Math.round(entry.overallPercentage || 0)}%`,
      }))

      setHistoryRows(rows)
    } catch {
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const submitSet = async () => {
    if (!practiceSet || !selectedTopic) return

    const questions = practiceSet.questions || []
    const attempted = questions.filter((question) => answers[question.id] !== undefined).length
    const correct = questions.reduce((sum, question) => {
      const selected = answers[question.id]
      if (selected === undefined) return sum
      return sum + (selected === resolveCorrectOptionIndex(question) ? 1 : 0)
    }, 0)

    const avgConfidence =
      questions.length > 0
        ? questions.reduce((sum, question) => {
            const label = confidenceByQuestion[question.id] || 'medium'
            return sum + (CONFIDENCE_VALUES[label] || CONFIDENCE_VALUES.medium)
          }, 0) / questions.length
        : CONFIDENCE_VALUES.medium

    const totalTimeSec = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000))

    setSubmitting(true)
    setErrorMessage('')

    try {
      const payload = await submitTopicPracticeSession({
        topicId: selectedTopic.id,
        questionCount: questions.length,
        attemptedCount: attempted,
        correctCount: correct,
        totalTimeSec,
        avgConfidence,
      })

      const rows = questions.map((question, index) => {
        const selected = answers[question.id]
        const correctIndex = resolveCorrectOptionIndex(question)
        const isAttempted = selected !== undefined
        const isCorrect = isAttempted && selected === correctIndex

        return {
          id: question.id,
          question: `Q${index + 1}`,
          selected: isAttempted ? question.options[selected] : 'Not answered',
          correct: question.options[correctIndex],
          status: (
            <Badge status={isCorrect ? 'success' : isAttempted ? 'warning' : 'info'}>
              {isCorrect ? 'Correct' : isAttempted ? 'Incorrect' : 'Skipped'}
            </Badge>
          ),
          topic: question.topicName,
        }
      })

      setResult({
        session: payload.session,
        ledger: payload.ledger,
        rows,
      })

      setPracticeSet(null)
      setAnswers({})
      setConfidenceByQuestion({})
    } catch (error) {
      setErrorMessage(error.message || 'Unable to submit practice results.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">Topic Practice</p>
        <h1>Practice Any Topic and Sync Real Progress</h1>
        <p>
          Generate focused questions for a topic, answer with confidence signals, and sync results into
          retention, coverage, and practice metrics.
        </p>
      </section>

      <Card title="Practice Builder" subtitle="Select one topic and launch a focused question set">
        <div className="form-grid practice-config-grid">
          <label>
            Question Count
            <input
              type="number"
              min="3"
              max="12"
              value={questionCount}
              onChange={(event) => {
                const next = Number(event.target.value) || 3
                setQuestionCount(Math.max(3, Math.min(12, next)))
              }}
            />
          </label>
        </div>

        <div className="practice-foldout-list">
          {SUBJECT_ORDER.map((subject) => (
            <details key={subject} className="practice-foldout" open={subject === 'Physics'}>
              <summary>
                <span>{subject}</span>
                <Chip tone="neutral">{groupedTopics[subject].length} Topics</Chip>
              </summary>

              <div className="practice-topic-grid">
                {groupedTopics[subject].map((topic) => {
                  const avgAttemptPerTest =
                    topic.testsTaken > 0 ? (topic.practicedQuestions || 0) / topic.testsTaken : 0
                  const active = selectedTopicId === topic.id

                  return (
                    <article key={topic.id} className={`practice-topic-card ${active ? 'practice-topic-card--active' : ''}`}>
                      <div className="practice-topic-card__head">
                        <h3>{topic.name}</h3>
                        <Badge status={topic.covered ? 'success' : 'warning'}>
                          {topic.covered ? 'Covered' : 'Needs Practice'}
                        </Badge>
                      </div>

                      <div className="chip-row">
                        <Chip tone="brand">Avg Accuracy: {Math.round((topic.practiceAccuracy || 0) * 100)}%</Chip>
                        <Chip tone="neutral">Avg Questions per Test: {avgAttemptPerTest.toFixed(1)}</Chip>
                        <Chip tone="neutral">Total Questions Practiced: {topic.practicedQuestions || 0}</Chip>
                        <Chip tone="success">Test Avg: {Math.round(topic.averageTestPercentage || 0)}%</Chip>
                      </div>

                      <div className="inline-actions">
                        <Button onClick={() => generateSetForTopic(topic.id)} disabled={loadingSet}>
                          {loadingSet && active ? 'Generating...' : 'Practice Topic'}
                        </Button>
                        <Button variant="ghost" onClick={() => openHistoryForTopic(topic)}>
                          History
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </details>
          ))}
        </div>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      </Card>

      {practiceSet ? (
        <Card
          title="Active Practice"
          subtitle={`Answer all questions for ${selectedTopic?.name || 'selected topic'}`}
          action={<Badge status="info">{answeredCount}/{practiceSet.questions.length} Answered</Badge>}
        >
          <div className="practice-question-list">
            {practiceSet.questions.map((question, index) => (
              <article key={question.id} className="attempt-question-card">
                <div>
                  <p className="muted-copy">Question {index + 1}</p>
                  <p className="review-prompt">{question.prompt}</p>
                </div>

                <div className="attempt-options">
                  {question.options.map((option, optionIndex) => (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      className={`attempt-option ${
                        answers[question.id] === optionIndex ? 'attempt-option--selected' : ''
                      }`}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: optionIndex,
                        }))
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="chip-row">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={`${question.id}-${level}`}
                      type="button"
                      className={`confidence-pill ${
                        confidenceByQuestion[question.id] === level ? 'confidence-pill--active' : ''
                      }`}
                      onClick={() =>
                        setConfidenceByQuestion((current) => ({
                          ...current,
                          [question.id]: level,
                        }))
                      }
                    >
                      <Chip
                        tone={
                          level === 'high' ? 'success' : level === 'low' ? 'alert' : 'brand'
                        }
                      >
                        {level}
                      </Chip>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="action-row">
            <Button onClick={submitSet} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Topic Practice'}
            </Button>
          </div>
        </Card>
      ) : null}

      {result ? (
        <Card
          title="Practice Result"
          subtitle="Session analytics were synced to your learning ledger"
          action={<Badge status="success">Saved</Badge>}
        >
          <div className="chip-row">
            <Chip tone="brand">Accuracy: {Math.round((result.session.accuracy || 0) * 100)}%</Chip>
            <Chip tone="success">Correct: {result.session.correctCount}</Chip>
            <Chip tone="alert">Incorrect: {result.session.incorrectCount}</Chip>
            <Chip tone="neutral">Skipped: {result.session.skippedCount}</Chip>
            <Chip tone="neutral">Time: {result.session.totalTimeSec}s</Chip>
          </div>

          <p className="muted-copy practice-ledger-copy">
            Updated ledger totals: {result.ledger.practicedQuestions} attempts and{' '}
            {Math.round((result.ledger.practiceAccuracy || 0) * 100)}% overall practice accuracy.
          </p>

          <DataTable columns={RESULT_COLUMNS} rows={result.rows} />
        </Card>
      ) : null}

      <Modal
        open={historyOpen}
        title={`Test History${historyTopic ? ` - ${historyTopic.name}` : ''}`}
        onClose={() => {
          setHistoryOpen(false)
          setHistoryRows([])
        }}
      >
        {historyLoading ? (
          <p className="muted-copy">Loading test history...</p>
        ) : (
          <DataTable columns={HISTORY_COLUMNS} rows={historyRows} emptyMessage="No previous tests found for this topic." />
        )}
      </Modal>
    </div>
  )
}

export default PracticePage
