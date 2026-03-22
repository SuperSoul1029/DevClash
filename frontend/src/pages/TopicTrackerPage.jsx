import { useMemo } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Chip from '../components/ui/Chip.jsx'
import Button from '../components/ui/Button.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import { useLearning } from '../context/LearningContext.jsx'

const TOPIC_COLUMNS = [
  { key: 'topic', header: 'Topic' },
  { key: 'status', header: 'Status' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'completed', header: 'Completed' },
  { key: 'practice', header: 'Practice' },
  { key: 'tests', header: 'Test Avg' },
  { key: 'source', header: 'Coverage Source' },
  { key: 'actions', header: 'Actions' },
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

function createTopicRow(topic, markTopicCompleted, unmarkTopicCompleted, clearTopicOverride) {
  return {
    id: topic.id,
    topic: topic.name,
    status: (
      <Badge status={topic.covered ? 'success' : 'warning'}>
        {topic.covered ? 'Covered' : 'Needs Practice'}
      </Badge>
    ),
    confidence: <Chip tone={topic.confidence === 'Low' ? 'alert' : 'neutral'}>{topic.confidence}</Chip>,
    completed: topic.completionCount,
    practice: `${Math.round((topic.practiceAccuracy || 0) * 100)}% (${topic.practicedQuestions})`,
    tests: topic.testsTaken > 0 ? `${Math.round(topic.averageTestPercentage || 0)}%` : 'No tests',
    source: <Chip tone="brand">{topic.overrideLabel}</Chip>,
    actions: (
      <div className="inline-actions">
        <Button variant="ghost" onClick={() => markTopicCompleted(topic.id)}>
          Mark Complete
        </Button>
        <Button variant="ghost" onClick={() => unmarkTopicCompleted(topic.id)}>
          Unmark
        </Button>
        <Button
          variant="ghost"
          onClick={() => clearTopicOverride(topic.id)}
          disabled={topic.manualOverride === null}
        >
          Reset Auto
        </Button>
      </div>
    ),
  }
}

function TopicTrackerPage() {
  const {
    topics,
    markTopicCompleted,
    unmarkTopicCompleted,
    clearTopicOverride,
  } = useLearning()

  const coveredCount = topics.filter((topic) => topic.covered).length
  const atRiskCount = topics.filter(
    (topic) => !topic.covered || topic.confidence === 'Low',
  ).length
  const untouchedCount = topics.filter(
    (topic) => !topic.covered && topic.manualOverride === null,
  ).length

  const groupedRows = useMemo(() => {
    const groups = {
      Physics: [],
      Chemistry: [],
      Mathematics: [],
      Other: [],
    }

    topics.forEach((topic) => {
      const subject = normalizeSubjectLabel(topic)
      groups[subject].push(
        createTopicRow(topic, markTopicCompleted, unmarkTopicCompleted, clearTopicOverride),
      )
    })

    return groups
  }, [topics, markTopicCompleted, unmarkTopicCompleted, clearTopicOverride])

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">Topic Tracker</p>
        <h1>Coverage Signals and Manual Controls</h1>
        <p>Blend auto-detected progress with manual mark and unmark overrides.</p>
      </section>

      <Card
        title="Coverage Snapshot"
        subtitle="Manual actions persist and override auto signals until reset"
        action={<Badge status="info">Sync Active</Badge>}
      >
        <div className="chip-row">
          <Chip tone="success">{coveredCount} Covered</Chip>
          <Chip tone="alert">{atRiskCount} At Risk</Chip>
          <Chip tone="neutral">{untouchedCount} Untouched</Chip>
        </div>
      </Card>

      <Card title="Tracked Topics" subtitle="Grouped by Physics, Chemistry, and Mathematics">
        <div className="topic-groups">
          {SUBJECT_ORDER.map((subject) => (
            <section key={subject} className="topic-group">
              <div className="topic-group__header">
                <h3>{subject}</h3>
                <Chip tone="neutral">{groupedRows[subject].length} Topics</Chip>
              </div>
              <DataTable
                columns={TOPIC_COLUMNS}
                rows={groupedRows[subject]}
                emptyMessage={`No ${subject.toLowerCase()} topics available.`}
              />
            </section>
          ))}
          {groupedRows.Other.length > 0 ? (
            <section className="topic-group">
              <div className="topic-group__header">
                <h3>Other</h3>
                <Chip tone="neutral">{groupedRows.Other.length} Topics</Chip>
              </div>
              <DataTable columns={TOPIC_COLUMNS} rows={groupedRows.Other} />
            </section>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

export default TopicTrackerPage
