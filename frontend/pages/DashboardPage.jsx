import { useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Chip from '../components/ui/Chip.jsx'
import ChartFrame from '../components/ui/ChartFrame.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Button from '../components/ui/Button.jsx'
import { useLearning } from '../context/LearningContext.jsx'

function formatDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function statusTone(status) {
  if (status === 'Completed') return 'success'
  if (status === 'Overdue' || status === 'Skipped') return 'alert'
  if (status === 'Today') return 'brand'
  return 'neutral'
}

function statusBadge(status) {
  if (status === 'Completed') return 'success'
  if (status === 'Overdue' || status === 'Skipped') return 'warning'
  return 'info'
}

const PLANNER_COLUMNS = [
  { key: 'topic', header: 'Topic' },
  { key: 'type', header: 'Task Type' },
  { key: 'date', header: 'Date' },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: 'Actions' },
]

const PLANNER_BUILDER_COLUMNS = [
  { key: 'pick', header: 'Pick' },
  { key: 'topic', header: 'Topic' },
  { key: 'subject', header: 'Subject' },
  { key: 'coverage', header: 'Coverage' },
  { key: 'completed', header: 'Completed' },
  { key: 'practice', header: 'Practice' },
  { key: 'tests', header: 'Test Avg' },
  { key: 'intent', header: 'Intent' },
  { key: 'familiarity', header: 'Familiarity' },
  { key: 'day', header: 'Planned Day' },
]

function toDateInputValue(date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value.toISOString().slice(0, 10)
}

function getTopicPriority(topic, config) {
  const familiarityBoost = config.familiarity === 'new' ? 25 : config.familiarity === 'basic' ? 12 : 4
  const intentBoost = config.intent === 'cover' ? 18 : 10
  const coverageWeight = topic.covered ? 4 : 20
  const retentionWeight = Math.round((100 - (topic.retentionScore || 0)) * 0.25)
  const practiceWeight = Math.round((1 - (topic.practiceAccuracy || 0)) * 24)
  const testWeight = Math.round((100 - (topic.averageTestPercentage || 0)) * 0.12)

  return familiarityBoost + intentBoost + coverageWeight + retentionWeight + practiceWeight + testWeight
}

function defaultFamiliarity(topic) {
  if ((topic.retentionScore || 0) < 45) return 'new'
  if ((topic.retentionScore || 0) < 70) return 'basic'
  return 'strong'
}

function DashboardPage() {
  const [replanDate, setReplanDate] = useState({})
  const [plannerConfigured, setPlannerConfigured] = useState(false)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [timeframeDays, setTimeframeDays] = useState(7)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [builderError, setBuilderError] = useState('')
  const [topicSelections, setTopicSelections] = useState({})
  const {
    retentionScore,
    todayPlan,
    overdueTasks,
    weakTopics,
    tasks,
    topics,
    subjectProgress,
    calendarGroups,
    plannerView,
    completedTasks,
    completeTask,
    skipTask,
    replanTask,
    setPlannerView,
    generateCustomPlan,
  } = useLearning()

  const initializeTopicConfig = () => {
    const next = {}
    topics.forEach((topic) => {
      next[topic.id] = {
        selected: false,
        intent: topic.covered ? 'revise' : 'cover',
        familiarity: defaultFamiliarity(topic),
        preferredDate: '',
      }
    })
    setTopicSelections(next)
  }

  const openBuilder = () => {
    setBuilderError('')
    initializeTopicConfig()
    setGoalText('')
    setTimeframeDays(7)
    setIsBuilderOpen(true)
  }

  const selectedTopicEntries = useMemo(
    () => topics.filter((topic) => topicSelections[topic.id]?.selected),
    [topics, topicSelections],
  )

  const suggestedDates = useMemo(() => {
    const sorted = [...selectedTopicEntries].sort((left, right) => {
      const leftPriority = getTopicPriority(left, topicSelections[left.id])
      const rightPriority = getTopicPriority(right, topicSelections[right.id])
      return rightPriority - leftPriority
    })

    const map = {}
    const horizon = Math.max(1, Number(timeframeDays) || 1)
    sorted.forEach((topic, index) => {
      const offset = Math.min(horizon - 1, index)
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() + offset)
      map[topic.id] = toDateInputValue(day)
    })

    return map
  }, [selectedTopicEntries, timeframeDays, topicSelections])

  const plannerBuilderRows = topics.map((topic) => {
    const config =
      topicSelections[topic.id] ||
      {
        selected: false,
        intent: topic.covered ? 'revise' : 'cover',
        familiarity: defaultFamiliarity(topic),
        preferredDate: '',
      }

    return {
      id: topic.id,
      pick: (
        <input
          type="checkbox"
          checked={config.selected}
          onChange={(event) =>
            setTopicSelections((current) => ({
              ...current,
              [topic.id]: {
                ...config,
                selected: event.target.checked,
              },
            }))
          }
          aria-label={`Select ${topic.name}`}
        />
      ),
      topic: topic.name,
      subject: `${topic.subjectName} (${topic.classLevel || '-'})`,
      coverage: (
        <Chip tone={topic.covered ? 'success' : 'alert'}>{topic.covered ? 'Covered' : 'Not Covered'}</Chip>
      ),
      completed: topic.completionCount,
      practice: `${Math.round((topic.practiceAccuracy || 0) * 100)}% (${topic.practicedQuestions})`,
      tests: topic.testsTaken > 0 ? `${Math.round(topic.averageTestPercentage || 0)}%` : 'No tests',
      intent: (
        <select
          value={config.intent}
          onChange={(event) =>
            setTopicSelections((current) => ({
              ...current,
              [topic.id]: {
                ...config,
                intent: event.target.value,
              },
            }))
          }
          disabled={!config.selected}
          aria-label={`Intent for ${topic.name}`}
        >
          <option value="cover">Cover</option>
          <option value="revise">Revise</option>
        </select>
      ),
      familiarity: (
        <select
          value={config.familiarity}
          onChange={(event) =>
            setTopicSelections((current) => ({
              ...current,
              [topic.id]: {
                ...config,
                familiarity: event.target.value,
              },
            }))
          }
          disabled={!config.selected}
          aria-label={`Familiarity for ${topic.name}`}
        >
          <option value="new">New</option>
          <option value="basic">Basic</option>
          <option value="strong">Strong</option>
        </select>
      ),
      day: (
        <input
          type="date"
          value={config.preferredDate || suggestedDates[topic.id] || ''}
          onChange={(event) =>
            setTopicSelections((current) => ({
              ...current,
              [topic.id]: {
                ...config,
                preferredDate: event.target.value,
              },
            }))
          }
          disabled={!config.selected}
          aria-label={`Plan day for ${topic.name}`}
        />
      ),
    }
  })

  const generatePlanFromGoals = async () => {
    setBuilderError('')
    const picked = selectedTopicEntries

    if (goalText.trim().length < 5) {
      setBuilderError('Add a clear goal so the planner can prioritize the right topics.')
      return
    }

    if (!picked.length) {
      setBuilderError('Pick at least one topic to generate a custom plan.')
      return
    }

    setIsGeneratingPlan(true)
    try {
      await generateCustomPlan({
        goalText: goalText.trim(),
        timeframeDays: Number(timeframeDays),
        selectedTopics: picked.map((topic) => {
          const config = topicSelections[topic.id]
          const dateValue = config.preferredDate || suggestedDates[topic.id]
          return {
            topicId: topic.id,
            intent: config.intent,
            familiarity: config.familiarity,
            preferredDate: `${dateValue}T00:00:00.000Z`,
          }
        }),
      })

      setPlannerConfigured(true)
      setIsBuilderOpen(false)
    } catch {
      setBuilderError('Unable to generate plan right now. Please retry once.')
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const stats = [
    {
      label: 'Retention',
      value: `${retentionScore}%`,
      badge: retentionScore >= 70 ? 'On Track' : 'Needs Recovery',
      status: retentionScore >= 70 ? 'success' : 'warning',
    },
    {
      label: 'Today Plan',
      value: `${todayPlan} tasks`,
      badge: todayPlan > 0 ? 'Ready' : 'Clear',
      status: 'info',
    },
    {
      label: 'Weak Topics',
      value: `${weakTopics.length}`,
      badge: weakTopics.length ? 'Watchlist' : 'Healthy',
      status: weakTopics.length ? 'warning' : 'success',
    },
  ]

  const plannerRows = tasks.map((task) => ({
    id: task.id,
    topic: task.topic,
    type: task.type,
    date: formatDate(task.scheduledDate),
    status: (
      <Badge status={statusBadge(task.displayStatus)}>{task.displayStatus}</Badge>
    ),
    actions: (
      <div className="inline-actions">
        <Button
          variant="ghost"
          onClick={() => completeTask(task.id)}
          disabled={task.displayStatus === 'Completed'}
        >
          Complete
        </Button>
        <Button
          variant="ghost"
          onClick={() => skipTask(task.id)}
          disabled={task.displayStatus === 'Completed' || task.displayStatus === 'Skipped'}
        >
          Skip
        </Button>
        <input
          type="date"
          value={replanDate[task.id] ?? ''}
          onChange={(event) =>
            setReplanDate((current) => ({
              ...current,
              [task.id]: event.target.value,
            }))
          }
          aria-label={`Replan ${task.topic}`}
        />
        <Button
          variant="ghost"
          onClick={() => {
            if (replanDate[task.id]) {
              replanTask(task.id, replanDate[task.id])
            }
          }}
          disabled={!replanDate[task.id]}
        >
          Replan
        </Button>
      </div>
    ),
  }))

  const retentionBars = [
    Math.max(retentionScore - 20, 35),
    Math.max(retentionScore - 12, 40),
    Math.max(retentionScore - 6, 45),
    retentionScore,
    Math.min(retentionScore + 4, 95),
    Math.min(retentionScore + 2, 92),
    retentionScore,
  ]

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">Home Dashboard</p>
        <h1>Daily Learning Command Center</h1>
        <p>
          Track retention momentum, run today&apos;s planner workflow, and react to weak concepts.
        </p>
      </section>

      <section className="stats-row" aria-label="Dashboard summary">
        {stats.map((item) => (
          <Card
            key={item.label}
            title={item.label}
            action={<Badge status={item.status}>{item.badge}</Badge>}
          >
            <p className="metric-value">{item.value}</p>
          </Card>
        ))}
      </section>

      <section className="split-grid">
        <Card title="Retention Curve" subtitle="Score updates from planner and topic actions">
          <ChartFrame title="7-day retention" caption="Updates as tasks are completed or skipped">
            <div className="chart-placeholder">
              {retentionBars.map((point, index) => (
                <span key={index} style={{ height: `${point}%` }} />
              ))}
            </div>
          </ChartFrame>
        </Card>

        <Card title="Focus Bands" subtitle="Signals generated from current learning state">
          <div className="chip-row">
            <Chip tone="alert">{overdueTasks} Overdue</Chip>
            <Chip tone="brand">{todayPlan} Today</Chip>
            <Chip tone="success">{completedTasks} Completed</Chip>
          </div>
          <div className="weak-topic-list">
            {weakTopics.length ? (
              weakTopics.slice(0, 5).map((topic) => (
                <Chip key={topic} tone="neutral">
                  {topic}
                </Chip>
              ))
            ) : (
              <p className="muted-copy">No weak topics detected from current signals.</p>
            )}
          </div>
        </Card>
      </section>

      <Card
        title="Today Planner"
        subtitle="Goal-based planner builder powered by your topic coverage, tests, and practice progress"
        action={
          plannerConfigured ? (
            <div className="view-toggle">
              <Button variant="ghost" onClick={openBuilder}>
                Customize Plan
              </Button>
              <Button
                variant={plannerView === 'list' ? 'primary' : 'ghost'}
                onClick={() => setPlannerView('list')}
              >
                List
              </Button>
              <Button
                variant={plannerView === 'calendar' ? 'primary' : 'ghost'}
                onClick={() => setPlannerView('calendar')}
              >
                Calendar
              </Button>
            </div>
          ) : null
        }
      >
        {!plannerConfigured && !isBuilderOpen ? (
          <div className="planner-generate-center">
            <Button variant="primary" onClick={openBuilder}>
              Generate Plan
            </Button>
            <p className="muted-copy planner-generate-copy">
              Start with your goals, topics to revise or cover, timeframe, and familiarity level.
            </p>
          </div>
        ) : null}

        {isBuilderOpen ? (
          <div className="planner-builder">
            <div className="form-grid planner-builder-grid">
              <label>
                Goal
                <textarea
                  value={goalText}
                  onChange={(event) => setGoalText(event.target.value)}
                  placeholder="Example: Complete high-weight weak topics before Sunday mock test"
                  rows={3}
                />
              </label>
              <label>
                Time Period (days)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={timeframeDays}
                  onChange={(event) => setTimeframeDays(Number(event.target.value) || 1)}
                />
              </label>
            </div>

            <Card title="Topic Selection" subtitle="Select topics manually and tune intent, familiarity, and day">
              <DataTable columns={PLANNER_BUILDER_COLUMNS} rows={plannerBuilderRows} />
            </Card>

            <Card title="Subject Progress Ledger" subtitle="Unified counters used across planner, tests, and quizzes">
              <div className="chip-row">
                {subjectProgress.map((subject) => (
                  <Chip key={subject.subjectId} tone="neutral">
                    {subject.subjectName}: {subject.coveredTopics}/{subject.totalTopics} covered, {Math.round((subject.practiceAccuracy || 0) * 100)}% practice
                  </Chip>
                ))}
              </div>
            </Card>

            {builderError ? <p className="form-error">{builderError}</p> : null}

            <div className="action-row planner-builder-actions">
              <Button variant="ghost" onClick={() => setIsBuilderOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={generatePlanFromGoals} disabled={isGeneratingPlan}>
                {isGeneratingPlan ? 'Generating...' : 'Generate Final Plan'}
              </Button>
            </div>
          </div>
        ) : null}

        {plannerConfigured && !isBuilderOpen ? (
          plannerView === 'list' ? (
            <DataTable columns={PLANNER_COLUMNS} rows={plannerRows} />
          ) : (
            <div className="calendar-grid">
              {calendarGroups.map((group) => (
                <article key={group.date} className="calendar-card">
                  <p className="calendar-date">{formatDate(group.date)}</p>
                  <div className="calendar-items">
                    {group.tasks.map((task) => (
                      <div key={task.id} className="calendar-item">
                        <p>{task.topic}</p>
                        <div className="chip-row">
                          <Chip tone={statusTone(task.displayStatus)}>{task.displayStatus}</Chip>
                          <Chip tone="neutral">{task.durationMin} mins</Chip>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )
        ) : null}
      </Card>
    </div>
  )
}

export default DashboardPage
