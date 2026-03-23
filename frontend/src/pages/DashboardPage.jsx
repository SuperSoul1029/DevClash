import { useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
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

const PLANNER_COLUMNS = [
  { key: 'topic', header: 'Topic' },
  { key: 'type', header: 'Task Type' },
  { key: 'date', header: 'Date' },
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

  if (/(thermodynamics|newton|motion|work\s*energy|harmonic|mechanics|waves|optics|electrostatics|current\s*electricity|magnet|ray|nuclei|semiconductor)/.test(topicLabel)) {
    return 'Physics'
  }
  if (/(atomic|bonding|mole|stoichi|organic|inorganic|chemical|equilibrium|electrochem|solid\s*state|solutions|kinetics|surface\s*chemistry|p\s*block|d\s*block|coordination)/.test(topicLabel)) {
    return 'Chemistry'
  }
  if (/(algebra|calculus|geometry|trigon|relations|function|probability|matrix|determinant|vector|statistics|binomial|sequence|series|integration|differentiation)/.test(topicLabel)) {
    return 'Mathematics'
  }

  return 'Mathematics'
}

function difficultyLabel(difficulty) {
  if (difficulty === 'hard') return 'Hard'
  if (difficulty === 'easy') return 'Easy'
  return 'Moderate'
}

function clampRetention(value) {
  return Math.max(18, Math.min(99, Math.round(value)))
}

function formatChartDateKey(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function startOfSundayWeek(anchorDate) {
  const start = new Date(anchorDate)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return start
}

function parseDateValue(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function createWeeklyAxis(anchorDate = new Date()) {
  const start = startOfSundayWeek(anchorDate)
  const todayKey = formatChartDateKey(anchorDate)

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = formatChartDateKey(date)

    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      index,
      isToday: key === todayKey,
      isPast: key < todayKey,
    }
  })

  const todayIndex = Math.max(0, days.findIndex((day) => day.isToday))

  return {
    days,
    todayIndex,
    dayIndexByKey: new Map(days.map((day) => [day.key, day.index])),
  }
}

function createTopicColor(index) {
  const hue = (index * 47 + 12) % 360
  return `hsl(${hue} 64% 46%)`
}

function collectReviewDayIndexes(topic, _tasks, dayIndexByKey) {
  const reviewDayIndexes = new Set()
  if (!topic.covered) {
    return []
  }

  const hasExplicitRevisionPlan = Boolean(topic.lastReviewedAt || Number(topic.totalReviews || 0) > 0)
  if (!hasExplicitRevisionPlan) {
    return []
  }

  const recommendedDate = parseDateValue(topic.recommendedRevisionDate || topic.nextReviewAt)

  if (recommendedDate) {
    const recommendedKey = formatChartDateKey(recommendedDate)
    const weekIndex = dayIndexByKey.get(recommendedKey)
    if (weekIndex !== undefined) {
      reviewDayIndexes.add(weekIndex)
    }
  }

  return [...reviewDayIndexes].sort((left, right) => left - right)
}

function createTopicCurvePoints(topic, reviewDayIndexes, totalDays) {
  const reviewDaySet = new Set(reviewDayIndexes)
  const inferredBase = Number(topic.retentionScore || 56)
  const priorReviews = Math.max(0, Number(topic.totalReviews || 0))
  const initialLift = 10 + Math.min(12, priorReviews * 1.8)

  let current = clampRetention(inferredBase + initialLift)
  if (reviewDaySet.has(0)) {
    current = clampRetention(current + 8)
  }

  let stability = 1 + Math.min(2.6, priorReviews * 0.35)
  const points = [{ x: 0, value: current, type: 'start' }]

  for (let dayIndex = 0; dayIndex < totalDays - 1; dayIndex += 1) {
    const decayExponent = 0.18 / Math.max(0.8, stability)
    const dayFatigue = Math.max(0.4, 1.8 - stability * 0.28)
    const decayValue = clampRetention(current * Math.exp(-decayExponent) - dayFatigue)
    const decayX = dayIndex + 0.82

    points.push({ x: decayX, value: decayValue, type: 'decay' })

    let nextValue = decayValue
    const hasReview = reviewDaySet.has(dayIndex + 1)

    if (hasReview) {
      const recoveryFromLow = Math.max(0, 80 - decayValue) * 0.38
      const reviewBoost = 10 + Math.max(6, 20 - priorReviews * 0.9)
      nextValue = clampRetention(decayValue + reviewBoost + recoveryFromLow)
      stability += 0.45
    } else {
      stability += 0.08
    }

    points.push({
      x: dayIndex + 1,
      value: nextValue,
      type: hasReview ? 'review' : 'anchor',
    })

    current = nextValue
  }

  return points
}

function createWeeklyRetentionSeries(tasks, topics) {
  const { days, todayIndex, dayIndexByKey } = createWeeklyAxis(new Date())
  const reviewCountByDay = {}

  const topicSeries = topics
    .map((topic) => {
      const reviewDayIndexes = collectReviewDayIndexes(topic, tasks, dayIndexByKey)
      if (!reviewDayIndexes.length) return null

      reviewDayIndexes.forEach((dayIndex) => {
        reviewCountByDay[dayIndex] = (reviewCountByDay[dayIndex] || 0) + 1
      })

      const points = createTopicCurvePoints(topic, reviewDayIndexes, days.length)
      const realizedPoints = points.filter((point) => point.x <= todayIndex + 0.001)
      const projectedPoints = points.filter((point) => point.x >= todayIndex - 0.001)

      return {
        topicId: topic.id,
        topicName: topic.name,
        reviewDayIndexes,
        points,
        realizedPoints,
        projectedPoints,
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftFirstReview = left.reviewDayIndexes[0] ?? 99
      const rightFirstReview = right.reviewDayIndexes[0] ?? 99
      if (leftFirstReview !== rightFirstReview) {
        return leftFirstReview - rightFirstReview
      }
      return left.topicName.localeCompare(right.topicName)
    })
    .map((series, index) => ({
      ...series,
      color: createTopicColor(index),
    }))

  const reviewMarkers = Object.entries(reviewCountByDay)
    .map(([x, count]) => ({
      x: Number(x),
      label: count === 1 ? '1 review' : `${count} reviews`,
    }))
    .sort((left, right) => left.x - right.x)

  return {
    days,
    todayIndex,
    topicSeries,
    reviewMarkers,
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

  const yTicks = [0, 20, 40, 60, 80, 100]

  if (!data.topicSeries.length) {
    return (
      <div className="weekly-retention-chart weekly-retention-chart--empty" role="status" aria-live="polite">
        No topics have revision dates scheduled in this Sunday to Saturday window.
      </div>
    )
  }

  return (
    <div className="weekly-retention-chart" role="img" aria-label="Weekly topic-level retention curves with review-day peaks">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
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
          <g key={`marker-${marker.x}`}>
            <line
              x1={xAt(marker.x)}
              y1={margin.top}
              x2={xAt(marker.x)}
              y2={margin.top + plotHeight}
              className="weekly-retention-chart__review-line"
            />
            <text x={xAt(marker.x) + 8} y={margin.top + plotHeight * 0.2} className="weekly-retention-chart__review-pill">
              {marker.label}
            </text>
          </g>
        ))}

        <line
          x1={xAt(data.todayIndex)}
          y1={margin.top}
          x2={xAt(data.todayIndex)}
          y2={margin.top + plotHeight}
          className="weekly-retention-chart__today-line"
        />

        {data.topicSeries.map((series) => {
          const realizedPath = buildSawtoothPath(series.realizedPoints, xAt, yAt)
          const projectedPath = buildSawtoothPath(series.projectedPoints, xAt, yAt)

          return (
            <g key={series.topicId}>
              {realizedPath ? (
                <path
                  d={realizedPath}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="weekly-retention-chart__curve"
                />
              ) : null}

              {projectedPath ? (
                <path
                  d={projectedPath}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  className="weekly-retention-chart__curve weekly-retention-chart__curve--projected"
                />
              ) : null}

              {series.points
                .filter((point) => point.type === 'review')
                .map((point) => (
                  <circle
                    key={`${series.topicId}-review-${point.x}`}
                    cx={xAt(point.x)}
                    cy={yAt(point.value)}
                    r="3.1"
                    fill={series.color}
                  />
                ))}
              {series.points
                .filter((point) => point.type === 'decay')
                .map((point) => (
                  <circle
                    key={`${series.topicId}-decay-${point.x}`}
                    cx={xAt(point.x)}
                    cy={yAt(point.value)}
                    r="2.2"
                    fill={series.color}
                    opacity="0.75"
                  />
                ))}
            </g>
          )
        })}

        {data.days.map((day, index) => (
          <text key={day.key} x={xAt(index)} y={margin.top + plotHeight + 18} textAnchor="middle" className="weekly-retention-chart__axis-label">
            {day.label}
          </text>
        ))}

        <text
          x={margin.left - 42}
          y={margin.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${margin.left - 42} ${margin.top + plotHeight / 2})`}
          className="weekly-retention-chart__title-label"
        >
          Retention (%)
        </text>
        <text x={width - 12} y={height - 8} textAnchor="end" className="weekly-retention-chart__title-label">
          Time (Days)
        </text>
      </svg>

      <div className="weekly-retention-chart__legend" aria-hidden="true">
        {data.topicSeries.map((series) => (
          <span key={`legend-${series.topicId}`}>
            <i style={{ background: series.color }} />
            {series.topicName}
          </span>
        ))}
      </div>
    </div>
  )
}

function DashboardPage() {
  const [replanDate, setReplanDate] = useState({})
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [builderError, setBuilderError] = useState('')
  const [selectedUncoveredTopicIds, setSelectedUncoveredTopicIds] = useState({})
  const {
    aiDebug,
    tasks,
    topics,
    subjectProgress,
    calendarGroups,
    plannerView,
    completeTask,
    skipTask,
    replanTask,
    setPlannerView,
    generateWeeklyPlan,
  } = useLearning()

  const hasPlannerTasks = tasks.length > 0

  const initializeBuilderSelection = () => {
    const next = {}
    topics.forEach((topic) => {
      if (!topic.covered) {
        next[topic.id] = false
      }
    })
    setSelectedUncoveredTopicIds(next)
  }

  const openBuilder = () => {
    setBuilderError('')
    initializeBuilderSelection()
    setIsBuilderOpen(true)
  }

  const uncoveredTopics = useMemo(() => topics.filter((topic) => !topic.covered), [topics])

  const uncoveredBySubject = useMemo(() => {
    const grouped = {
      Physics: [],
      Chemistry: [],
      Mathematics: [],
    }

    uncoveredTopics.forEach((topic) => {
      grouped[normalizeSubjectLabel(topic)].push(topic)
    })

    SUBJECT_ORDER.forEach((subject) => {
      grouped[subject] = grouped[subject].sort((left, right) => {
        const rank = { hard: 3, medium: 2, easy: 1 }
        const leftScore = rank[left.difficulty] || 2
        const rightScore = rank[right.difficulty] || 2
        if (leftScore !== rightScore) return rightScore - leftScore
        return left.name.localeCompare(right.name)
      })
    })

    return grouped
  }, [uncoveredTopics])

  const selectedUncoveredCount = useMemo(
    () => Object.values(selectedUncoveredTopicIds).filter(Boolean).length,
    [selectedUncoveredTopicIds],
  )

  const generateWeeklyPlanner = async () => {
    setBuilderError('')

    setIsGeneratingPlan(true)
    try {
      const selectedTopicIds = Object.entries(selectedUncoveredTopicIds)
        .filter(([, selected]) => Boolean(selected))
        .map(([topicId]) => topicId)

      await generateWeeklyPlan({
        selectedTopicIds,
        regenerate: hasPlannerTasks,
      })

      setIsBuilderOpen(false)
    } catch {
      setBuilderError('Unable to generate weekly planner right now. Please retry once.')
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const plannerRows = tasks.map((task) => ({
    id: task.id,
    topic: task.topic,
    type: task.type,
    date: formatDate(task.scheduledDate),
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
    <div className="page-grid dashboard-front-grid">
      <div className="dashboard-front-scribbles dashboard-front-scribbles--left" aria-hidden="true">
        <span className="dash-scribble dash-scribble--p1">tau = I * alpha</span>
        <span className="dash-scribble dash-scribble--m2">|v| = sqrt(a^2+b^2+c^2)</span>

        <svg className="dash-doodle dash-doodle--wheel" viewBox="0 0 56 56" role="presentation">
          <circle cx="28" cy="28" r="16" />
          <circle cx="28" cy="28" r="3" />
          <path d="M28 12v32" />
          <path d="M12 28h32" />
          <path d="M17 17l22 22" />
          <path d="M39 17L17 39" />
          <path d="M44 20c2 3 3 6 3 10" />
          <path d="M47 30l-4-1 2 4" />
        </svg>

        <svg className="dash-doodle dash-doodle--beaker" viewBox="0 0 56 56" role="presentation">
          <path d="M20 8h16" />
          <path d="M23 8v13l-12 19a8 8 0 0 0 7 12h20a8 8 0 0 0 7-12L33 21V8" />
          <path d="M16 34h24" />
          <path d="M21 39h14" />
        </svg>
      </div>

      <div className="dashboard-front-scribbles dashboard-front-scribbles--right" aria-hidden="true">
        <span className="dash-scribble dash-scribble--m1">v = ai + bj + ck</span>
        <span className="dash-scribble dash-scribble--p2">w = dtheta / dt</span>
        <span className="dash-scribble dash-scribble--c1">V = pi * r^2 * h</span>

        <svg className="dash-doodle dash-doodle--vector" viewBox="0 0 64 56" role="presentation">
          <path d="M10 46V10" />
          <path d="M10 46h40" />
          <path d="M10 46l30-24" />
          <path d="M37 22l4 1-1 4" />
          <path d="M10 10l-2 4h4" />
          <path d="M50 46l-4-2v4" />
        </svg>

        <svg className="dash-doodle dash-doodle--rotation" viewBox="0 0 72 56" role="presentation">
          <path d="M12 36c4-10 12-16 24-16 14 0 22 7 24 20" />
          <path d="M58 38l-6-1 3 5" />
          <path d="M20 44c8-2 14-6 18-12" />
          <path d="M38 32l-1 4 4-1" />
        </svg>
      </div>

      <h1 className="topic-tracker-title">Dashboard</h1>

      <Card
        title="Today Planner"
        subtitle="Weekly planner with automatic covered-topic revisions and difficulty-weighted uncovered topic coverage"
        action={
          hasPlannerTasks ? (
            <div className="view-toggle">
              <Button variant="ghost" onClick={openBuilder}>
                Regenerate Weekly Plan
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

        {!hasPlannerTasks && !isBuilderOpen ? (
          <div className="planner-generate-center">
            <Button variant="primary" onClick={openBuilder}>
              Generate Plan
            </Button>
            <p className="muted-copy planner-generate-copy">
              Start with uncovered topics for this week. Covered topics with revision dates in this week are added automatically.
            </p>
          </div>
        ) : null}

        {isBuilderOpen ? (
          <div className="planner-builder">
            <Card title="Uncovered Topics" subtitle="Pick topics to cover this week. Hard topics are automatically given more sessions.">
              <div className="planner-foldouts">
                {SUBJECT_ORDER.map((subject) => {
                  const rows = uncoveredBySubject[subject] || []

                  return (
                    <details key={subject} className="planner-foldout" open>
                      <summary>
                        <span>{subject}</span>
                        <Chip tone="neutral">{rows.length} topics</Chip>
                      </summary>

                      <div className="planner-foldout-list">
                        {rows.length ? rows.map((topic) => (
                          <label key={topic.id} className="planner-topic-option">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedUncoveredTopicIds[topic.id])}
                              onChange={(event) =>
                                setSelectedUncoveredTopicIds((current) => ({
                                  ...current,
                                  [topic.id]: event.target.checked,
                                }))
                              }
                              aria-label={`Select ${topic.name}`}
                            />
                            <div className="planner-topic-option__copy">
                              <p>{topic.name}</p>
                              <p>{topic.chapter || 'General'} · Class {topic.classLevel || '-'}</p>
                            </div>
                            <Chip tone={topic.difficulty === 'hard' ? 'warning' : topic.difficulty === 'easy' ? 'success' : 'info'}>
                              {difficultyLabel(topic.difficulty)}
                            </Chip>
                          </label>
                        )) : <p className="muted-copy">No uncovered topics in this subject.</p>}
                      </div>
                    </details>
                  )
                })}
              </div>
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
            <p className="muted-copy">
              {selectedUncoveredCount} uncovered topic{selectedUncoveredCount === 1 ? '' : 's'} selected. Covered topics due for revision this week will be auto-included.
            </p>

            <div className="action-row planner-builder-actions">
              <Button variant="ghost" onClick={() => setIsBuilderOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={generateWeeklyPlanner} disabled={isGeneratingPlan}>
                {isGeneratingPlan ? 'Generating...' : 'Generate Weekly Plan'}
              </Button>
            </div>
          </div>
        ) : null}

        {hasPlannerTasks && !isBuilderOpen ? (
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

      <section className="split-grid split-grid--single">
        <Card title="Retention Curve" subtitle="Score updates from planner and topic actions">
          <ChartFrame title="7-day retention" caption="Topic-level forgetting-curve projection: decay between reviews and reset peaks on revision days">
            <WeeklyRetentionChart data={weeklyRetentionData} />
          </ChartFrame>
        </Card>
      </section>
    </div>
  )
}

export default DashboardPage

