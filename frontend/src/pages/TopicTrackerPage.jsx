import { useMemo } from 'react'
import Card from '../components/ui/Card.jsx'
import Chip from '../components/ui/Chip.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import { useLearning } from '../context/LearningContext.jsx'

const TOPIC_COLUMNS = [
  { key: 'topic', header: 'Topic' },
  { key: 'status', header: 'Status' },
  { key: 'revisionCount', header: <>Revision<br />Count</> },
  { key: 'practice', header: <>Questions<br />Practiced</> },
  { key: 'tests', header: <>Test<br />Avg</> },
  { key: 'lastRevision', header: <>Last Revision<br />Date</> },
  { key: 'recommendedRevision', header: <>Recommended Revision<br />Date</> },
]

const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Mathematics']

function normalizeSubjectLabel(topic) {
  const nameLabel = String(topic.subjectName || '').toLowerCase()
  const codeLabel = String(topic.subjectCode || '').toLowerCase()
  const topicLabel = `${topic.name || ''} ${topic.chapter || ''}`.toLowerCase()

  const label = `${nameLabel} ${codeLabel}`

  if (/(\bphy\b|physics)/.test(label)) return 'Physics'
  if (/(\bche\b|chemistry|chemical)/.test(label)) return 'Chemistry'
  if (/(\bmth\b|math|mathematics|algebra|calculus|geometry|relations)/.test(label)) return 'Mathematics'

  if (/(thermodynamics|newton|motion|work,\s*energy|harmonic|mechanics|waves|optics)/.test(topicLabel)) {
    return 'Physics'
  }
  if (/(atomic|bonding|mole|stoichi|organic|inorganic|chemical|equilibrium|electrochem)/.test(topicLabel)) {
    return 'Chemistry'
  }
  if (/(algebra|calculus|geometry|trigon|relations|function|probability|matrix|determinant)/.test(topicLabel)) {
    return 'Mathematics'
  }

  if (label.includes('physics')) return 'Physics'
  if (label.includes('chem')) return 'Chemistry'
  if (label.includes('math')) return 'Mathematics'
  return 'Other'
}

function centeredCell(content) {
  return <div className="topic-tracker-cell">{content}</div>
}

function normalizeTopicName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pickPreferredTopic(current, incoming) {
  const currentScore =
    Number(Boolean(current.covered)) * 1000 +
    Number(current.totalReviews || 0) * 100 +
    Number(current.practicedQuestions || 0) * 10 +
    Number(current.testsTaken || 0)

  const incomingScore =
    Number(Boolean(incoming.covered)) * 1000 +
    Number(incoming.totalReviews || 0) * 100 +
    Number(incoming.practicedQuestions || 0) * 10 +
    Number(incoming.testsTaken || 0)

  if (incomingScore > currentScore) return incoming

  const currentNameLength = String(current.name || '').trim().length
  const incomingNameLength = String(incoming.name || '').trim().length
  return incomingNameLength > currentNameLength ? incoming : current
}

function createTopicRow(topic, actions) {
  return {
    id: topic.id,
    topic: centeredCell(topic.name),
    status: centeredCell(
      <select
        className={`topic-status-select ${topic.covered ? 'topic-status-select--covered' : 'topic-status-select--not-covered'}`}
        value={topic.covered ? 'covered' : 'not-covered'}
        onChange={(event) => {
          if (event.target.value === 'covered') {
            actions.markTopicCompleted(topic.id)
            return
          }

          actions.unmarkTopicCompleted(topic.id)
        }}
      >
        <option value="covered">Covered</option>
        <option value="not-covered">Not Covered</option>
      </select>,
    ),
    revisionCount: centeredCell(
      <div className="topic-revision-stepper">
        <span className="topic-revision-stepper__value">{topic.totalReviews || 0}</span>
        <button
          type="button"
          onClick={() => actions.incrementRevision(topic.id)}
          disabled={!topic.covered}
          className="topic-step-btn topic-step-btn--up"
          aria-label={`Increase revision count for ${topic.name}`}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => actions.decrementRevision(topic.id)}
          disabled={!topic.covered || (topic.totalReviews || 0) <= 0}
          className="topic-step-btn topic-step-btn--down"
          aria-label={`Decrease revision count for ${topic.name}`}
        >
          ▼
        </button>
      </div>,
    ),
    practice: centeredCell(topic.practicedQuestions || 0),
    tests: centeredCell(topic.testsTaken > 0 ? `${Math.round(topic.averageTestPercentage || 0)}%` : 'No tests'),
    lastRevision: centeredCell(
      topic.lastReviewedAt ? new Date(topic.lastReviewedAt).toLocaleDateString() : '-',
    ),
    recommendedRevision: centeredCell(
      <span style={{ color: topic.isRevisionDue ? 'var(--alert)' : 'inherit' }}>
        {topic.covered ? (topic.recommendedRevisionText || '-') : '-'}
      </span>,
    ),
  }
}

function TopicTrackerPage() {
  const {
    topics,
    markTopicCompleted,
    unmarkTopicCompleted,
    incrementRevision,
    decrementRevision,
  } = useLearning()

  const actions = useMemo(
    () => ({
      markTopicCompleted,
      unmarkTopicCompleted,
      incrementRevision,
      decrementRevision,
    }),
    [markTopicCompleted, unmarkTopicCompleted, incrementRevision, decrementRevision],
  )

  const groupedRows = useMemo(() => {
    const groups = {
      Physics: [],
      Chemistry: [],
      Mathematics: [],
      Other: [],
    }

    const uniqueTopicsByGroup = {
      Physics: new Map(),
      Chemistry: new Map(),
      Mathematics: new Map(),
      Other: new Map(),
    }

    topics.forEach((topic) => {
      const subject = normalizeSubjectLabel(topic)

      const topicKey = normalizeTopicName(topic.name)
      if (!topicKey) {
        return
      }

      const existing = uniqueTopicsByGroup[subject].get(topicKey)
      uniqueTopicsByGroup[subject].set(
        topicKey,
        existing ? pickPreferredTopic(existing, topic) : topic,
      )
    })

    Object.keys(groups).forEach((subject) => {
      uniqueTopicsByGroup[subject].forEach((topic) => {
        groups[subject].push(createTopicRow(topic, actions))
      })
    })

    return groups
  }, [topics, actions])

  return (
    <div className="page-grid">
      <h1 className="topic-tracker-title">Topic Tracker</h1>

      <Card
        className="topic-tracker-card"
        title="Tracked Topics"
        subtitle="Compact revision tracker with deterministic spacing recommendations"
      >
        <div className="topic-groups">
          {SUBJECT_ORDER.map((subject) => (
            <section key={subject} className="topic-group">
              <div className="topic-group__header">
                <h3>{subject}</h3>
                <Chip tone="neutral">{groupedRows[subject].length} Topics</Chip>
              </div>
              <div className="topic-tracker-table">
                <DataTable
                  columns={TOPIC_COLUMNS}
                  rows={groupedRows[subject]}
                  emptyMessage={`No ${subject.toLowerCase()} topics available.`}
                />
              </div>
            </section>
          ))}
          {groupedRows.Other.length > 0 ? (
            <section className="topic-group">
              <div className="topic-group__header">
                <h3>Other</h3>
                <Chip tone="neutral">{groupedRows.Other.length} Topics</Chip>
              </div>
              <div className="topic-tracker-table">
                <DataTable columns={TOPIC_COLUMNS} rows={groupedRows.Other} />
              </div>
            </section>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

export default TopicTrackerPage
