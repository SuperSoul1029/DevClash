import { useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Chip from '../components/ui/Chip.jsx'
import ChartFrame from '../components/ui/ChartFrame.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Button from '../components/ui/Button.jsx'
import { useLearning } from '../context/LearningContext.jsx'
import { useNavigate } from 'react-router-dom'

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

function normalizeSubjectName(name) {
  const value = (name || '').toLowerCase()
  if (value.includes('physics')) return 'Physics'
  if (value.includes('chem')) return 'Chemistry'
  if (value.includes('math')) return 'Maths'
  return null
}

function clampRetention(value) {
  return Math.max(20, Math.min(98, Math.round(value)))
}

function createWeeklyRetentionSeries(tasks, topics) {
  const targetSubjects = ['Physics', 'Chemistry', 'Maths']
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = today.toISOString().slice(0, 10)

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
    return { key, label }
  })

  const topicToSubject = new Map()
  const baselineAccumulator = {
    Physics: { total: 0, count: 0 },
    Chemistry: { total: 0, count: 0 },
    Maths: { total: 0, count: 0 },
  }

  topics.forEach((topic) => {
    const subject = normalizeSubjectName(topic.subjectName)
    if (!subject) return
    topicToSubject.set(topic.name, subject)
    baselineAccumulator[subject].total += topic.retentionScore || 0
    baselineAccumulator[subject].count += 1
  })

  const baseBySubject = {
    Physics:
      baselineAccumulator.Physics.count > 0
        ? baselineAccumulator.Physics.total / baselineAccumulator.Physics.count
        : 64,
    Chemistry:
      baselineAccumulator.Chemistry.count > 0
        ? baselineAccumulator.Chemistry.total / baselineAccumulator.Chemistry.count
        : 61,
    Maths:
      baselineAccumulator.Maths.count > 0
        ? baselineAccumulator.Maths.total / baselineAccumulator.Maths.count
        : 59,
  }

  const metricsBySubjectDay = Object.fromEntries(
    targetSubjects.map((subject) => [
      subject,
      Object.fromEntries(
        days.map((day) => [
          day.key,
          {
            completed: 0,
            skipped: 0,
            overdue: 0,
          },
        ]),
      ),
    ]),
  )

  const completedByDay = Object.fromEntries(days.map((day) => [day.key, 0]))

  tasks.forEach((task) => {
    if (!(task.scheduledDate in completedByDay)) return

    const knownSubject = topicToSubject.get(task.topic)
    const guessedSubject = normalizeSubjectName(task.topic)
    const subject = knownSubject || guessedSubject

    if (!subject || !targetSubjects.includes(subject)) return

    const bucket = metricsBySubjectDay[subject][task.scheduledDate]

    if (task.status === 'completed') {
      bucket.completed += 1
      completedByDay[task.scheduledDate] += 1
      return
    }

    if (task.status === 'skipped') {
      bucket.skipped += 1
      return
    }

    if (task.scheduledDate < todayKey) {
      bucket.overdue += 1
    }
  })

  const topReviewMarkers = days
    .slice(0, -1)
    .map((day, index) => ({ x: index + 1, count: completedByDay[day.key] }))
    .filter((marker) => marker.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 2)
    .sort((left, right) => left.x - right.x)

  const fallbackMarkers = [{ x: 2 }, { x: 4 }]
  const phaseMarkers = topReviewMarkers.length ? topReviewMarkers : fallbackMarkers
  const reviewPulseDays = new Set(phaseMarkers.map((marker) => marker.x))

  const decayRateBySubject = {
    Physics: 7,
    Chemistry: 6,
    Maths: 8,
  }

  const subjectSeries = {
    Physics: { points: [] },
    Chemistry: { points: [] },
    Maths: { points: [] },
  }

  targetSubjects.forEach((subject) => {
    const openingPeak = clampRetention(baseBySubject[subject] + 22)
    let current = openingPeak
    let lastPeak = openingPeak
    const points = [{ x: 0, value: current, type: 'start' }]

    days.forEach((day, dayIndex) => {
      const bucket = metricsBySubjectDay[subject][day.key]
      const penalty = bucket.skipped * 2 + bucket.overdue * 1.5
      const trendDrop = 1.2 + dayIndex * 0.8
      const decayEnd = clampRetention(current - decayRateBySubject[subject] - penalty - trendDrop)
      const decayX = Math.min(days.length - 1, dayIndex + 0.88)

      points.push({ x: decayX, value: decayEnd, type: 'decay' })

      let next = decayEnd
      const isReviewPulse = reviewPulseDays.has(dayIndex + 1)
      if (dayIndex < days.length - 1 && (bucket.completed > 0 || isReviewPulse)) {
        const completionBoost = bucket.completed > 0 ? Math.min(16, bucket.completed * 5) : 4
        const minJump = 9
        const desiredPeak = lastPeak - (dayIndex + 1) * 2.1 + completionBoost
        next = clampRetention(Math.max(decayEnd + minJump, desiredPeak))
        points.push({ x: dayIndex + 1, value: next, type: 'jump' })
        lastPeak = next
      }

      current = next
    })

    subjectSeries[subject] = { points }
  })

  return {
    days,
    subjectSeries,
    reviewMarkers: phaseMarkers.map((marker, index) => ({ x: marker.x, label: `Review ${index + 1}` })),
  }
}

function buildSawtoothPath(points, xAt, yAt) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${xAt(points[0].x)} ${yAt(points[0].value)}`

  let path = `M ${xAt(points[0].x)} ${yAt(points[0].value)}`

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const px = xAt(previous.x)
    const py = yAt(previous.value)
    const cx = xAt(current.x)
    const cy = yAt(current.value)

    if (current.type === 'decay') {
      const dx = cx - px
      const cp1x = px + dx * 0.35
      const cp1y = py
      const cp2x = cx - dx * 0.2
      const cp2y = cy + 6
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx} ${cy}`
    } else {
      path += ` L ${cx} ${cy}`
    }
  }

  return path
}

function WeeklyRetentionChart({ data }) {
  const width = 640
  const height = 280
  const margin = { top: 18, right: 24, bottom: 40, left: 44 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom

  const minRetention = 0
  const maxRetention = 100

  const xAt = (position) => {
    if (data.days.length <= 1) return margin.left
    const maxIndex = data.days.length - 1
    return margin.left + (position * plotWidth) / maxIndex
  }

  const yAt = (value) => {
    const ratio = (value - minRetention) / (maxRetention - minRetention)
    return margin.top + plotHeight - ratio * plotHeight
  }

  const colors = {
    Physics: '#e67878',
    Chemistry: '#e2b04e',
    Maths: '#6dc7bd',
  }

  const yTicks = [0, 20, 40, 60, 80, 100]
  const phaseStops = [0, ...data.reviewMarkers.map((marker) => marker.x), data.days.length - 1]
  const phaseColors = ['rgba(230, 120, 120, 0.16)', 'rgba(226, 176, 78, 0.16)', 'rgba(109, 199, 189, 0.2)']

  return (
    <div className="weekly-retention-chart" role="img" aria-label="Sawtooth weekly retention curve for Physics, Chemistry, and Maths">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {phaseStops.slice(0, -1).map((start, index) => {
          const end = phaseStops[index + 1]
          return (
            <rect
              key={`phase-${start}-${end}`}
              x={xAt(start)}
              y={margin.top}
              width={Math.max(0, xAt(end) - xAt(start))}
              height={plotHeight}
              fill={phaseColors[index] || phaseColors[phaseColors.length - 1]}
            />
          )
        })}

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              y1={yAt(tick)}
              x2={margin.left + plotWidth}
              y2={yAt(tick)}
              className="weekly-retention-chart__grid"
            />
            <text x={margin.left - 10} y={yAt(tick) + 4} textAnchor="end" className="weekly-retention-chart__axis-label">
              {tick}%
            </text>
          </g>
        ))}

        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} className="weekly-retention-chart__axis" />
        <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} className="weekly-retention-chart__axis" />

        {data.reviewMarkers.map((marker) => (
          <g key={marker.label}>
            <line
              x1={xAt(marker.x)}
              y1={margin.top}
              x2={xAt(marker.x)}
              y2={margin.top + plotHeight}
              className="weekly-retention-chart__review-line"
            />
            <text x={xAt(marker.x) + 8} y={margin.top + plotHeight * 0.56} className="weekly-retention-chart__review-pill">
              {marker.label}
            </text>
          </g>
        ))}

        {Object.entries(data.subjectSeries).map(([subject, series]) => {
          const path = buildSawtoothPath(series.points, xAt, yAt)

          return (
            <g key={subject}>
              <path d={path} fill="none" stroke={colors[subject]} strokeWidth="3.5" strokeLinecap="round" className="weekly-retention-chart__curve" />
              {series.points
                .filter((point) => point.type === 'jump')
                .map((point) => (
                  <circle key={`${subject}-jump-${point.x}`} cx={xAt(point.x)} cy={yAt(point.value)} r="3.2" fill={colors[subject]} />
                ))}
              {series.points
                .filter((point) => point.type === 'decay')
                .map((point) => (
                  <circle
                    key={`${subject}-decay-${point.x}`}
                    cx={xAt(point.x)}
                    cy={yAt(point.value)}
                    r="2.2"
                    fill={colors[subject]}
                    opacity="0.75"
                  />
                ))}
              {series.points[0] ? (
                <text
                  x={xAt(series.points[0].x) + 6}
                  y={yAt(series.points[0].value) - 8}
                  className="weekly-retention-chart__subject-tag"
                  fill={colors[subject]}
                >
                  {subject}
                </text>
              ) : null}
            </g>
          )
        })}

        {data.days.map((day, index) => (
          <text key={day.key} x={xAt(index)} y={margin.top + plotHeight + 18} textAnchor="middle" className="weekly-retention-chart__axis-label">
            {day.label}
          </text>
        ))}

        <text x={14} y={14} className="weekly-retention-chart__title-label">
          Retention %
        </text>
        <text x={width - 12} y={height - 8} textAnchor="end" className="weekly-retention-chart__title-label">
          Time (Days)
        </text>
      </svg>

      <div className="weekly-retention-chart__legend" aria-hidden="true">
        <span><i style={{ background: '#e67878' }} />Physics</span>
        <span><i style={{ background: '#e2b04e' }} />Chemistry</span>
        <span><i style={{ background: '#6dc7bd' }} />Maths</span>
      </div>
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
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
    aiDebug,
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

  const weeklyRetentionData = useMemo(() => createWeeklyRetentionSeries(tasks, topics), [tasks, topics])

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">Home Dashboard</p>
        <h1>Daily Learning Command Center</h1>
        <p>
          Track retention momentum, run today&apos;s planner workflow, and react to weak concepts.
        </p>
        <div className="hero-panel__actions">
          <Button
            variant="primary"
            className="mindmap-launch-btn"
            onClick={() => navigate('/mindmap')}
          >
            Mind Map
          </Button>
        </div>
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
          <ChartFrame title="7-day retention" caption="Combined Physics, Chemistry, and Maths retention trends across the week">
            <WeeklyRetentionChart data={weeklyRetentionData} />
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
        {aiDebug?.planner ? (
          <p className="debug-error-text">
            Planner AI fallback: {aiDebug.planner}
          </p>
        ) : null}

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

