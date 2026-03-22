import { useEffect, useMemo, useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Chip from '../components/ui/Chip.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { useLearning } from '../context/LearningContext.jsx'

const JOB_COLUMNS = [
  { key: 'video', header: 'Video' },
  { key: 'status', header: 'Status' },
  { key: 'mode', header: 'Mode' },
  { key: 'updated', header: 'Updated' },
  { key: 'actions', header: 'Action' },
]

function formatDateTime(isoDate) {
  if (!isoDate) return 'Not available'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

function isValidYoutubeUrl(url) {
  if (!url) return false

  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')
  } catch {
    return false
  }
}

function getStatusBadge(status) {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'warning'
  return 'info'
}

function YouTubeExplainerPage() {
  const {
    youtubeJobs,
    activeYoutubeJobId,
    startYoutubeExplainJob,
    setYoutubeActiveJob,
    resolveYoutubeJob,
    retryYoutubeJob,
  } = useLearning()

  const [videoUrl, setVideoUrl] = useState('')
  const [formError, setFormError] = useState('')

  const activeJob = useMemo(() => {
    if (!youtubeJobs.length) return null

    return (
      youtubeJobs.find((job) => job.id === activeYoutubeJobId) ??
      youtubeJobs[0]
    )
  }, [youtubeJobs, activeYoutubeJobId])

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'processing') return

    const poll = window.setInterval(() => {
      resolveYoutubeJob(activeJob.id)
    }, 1400)

    return () => window.clearInterval(poll)
  }, [activeJob, resolveYoutubeJob])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalized = videoUrl.trim()

    if (!isValidYoutubeUrl(normalized)) {
      setFormError('Please provide a valid YouTube URL (youtube.com or youtu.be).')
      return
    }

    setFormError('')

    try {
      await startYoutubeExplainJob(normalized)
      setVideoUrl('')
    } catch (error) {
      setFormError(error.message || 'Unable to start YouTube explain job.')
    }
  }

  const handleRetry = async () => {
    if (!activeJob) return

    try {
      await retryYoutubeJob(activeJob.id)
    } catch (error) {
      setFormError(error.message || 'Unable to retry this job.')
    }
  }

  const jobRows = youtubeJobs.map((job) => ({
    id: job.id,
    video: job.url,
    status: <Badge status={getStatusBadge(job.status)}>{job.status}</Badge>,
    mode: job.usedFallback ? 'Demo fallback' : job.status === 'succeeded' ? 'Transcript' : '-',
    updated: formatDateTime(job.updatedAt),
    actions: (
      <Button variant="ghost" onClick={() => setYoutubeActiveJob(job.id)}>
        View
      </Button>
    ),
  }))

  const output = activeJob?.output

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">YouTube AI Explainer</p>
        <h1>Video to Revision-Ready Insight</h1>
        <p>
          Drop a YouTube link to generate a plain-English overview, concise but detailed
          bullets, key concepts, and revision cards with resilient fallback behavior.
        </p>
      </section>

      <section className="split-grid">
        <Card
          title="Process New Video"
          subtitle="Supports robust loading states, retries, and deterministic demo fallback"
          action={<Badge status="info">Phase F4</Badge>}
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              YouTube URL
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
              />
            </label>

            {formError ? <p className="form-error">{formError}</p> : null}

            <div className="inline-actions">
              <Button type="submit">Generate Explainer</Button>
              <p className="muted-copy">Result now comes from backend media processing.</p>
            </div>
          </form>
        </Card>

        <Card title="Job History" subtitle="Track attempts and reopen previous outputs">
          <DataTable
            columns={JOB_COLUMNS}
            rows={jobRows}
            emptyMessage="No videos processed yet. Submit a YouTube URL to begin."
          />
        </Card>
      </section>

      <section>
        <Card
          title="Processing and Output"
          subtitle={
            activeJob
              ? `Last updated ${formatDateTime(activeJob.updatedAt)}`
              : 'No active job yet'
          }
          action={
            activeJob ? <Badge status={getStatusBadge(activeJob.status)}>{activeJob.status}</Badge> : null
          }
        >
          {!activeJob ? (
            <p className="empty-copy">
              Start a job to view processing progress and generated explainer content.
            </p>
          ) : null}

          {activeJob?.status === 'processing' ? (
            <div className="youtube-status-panel youtube-status-panel--processing">
              <div className="youtube-progress-head">
                <Spinner size="md" label="Processing YouTube explainer" />
                <p>{activeJob.progressStep}</p>
              </div>
            </div>
          ) : null}

          {activeJob?.status === 'failed' ? (
            <div className="youtube-status-panel youtube-status-panel--failed">
              <p className="form-error">{activeJob.errorMessage ?? 'Processing failed.'}</p>
              <div className="inline-actions">
                <Button onClick={handleRetry}>Retry Processing</Button>
                <Chip tone="alert">Attempt {activeJob.attemptCount ?? 1}</Chip>
              </div>
            </div>
          ) : null}

          {activeJob?.status === 'succeeded' && output ? (
            <div className="youtube-result-grid">
              <Card
                title={output.title}
                subtitle={
                  output.mode === 'demo-fallback'
                    ? 'Generated from deterministic fallback due to transcript quality constraints'
                    : 'Generated from transcript pipeline'
                }
                action={
                  output.mode === 'demo-fallback' ? (
                    <Badge status="warning">Fallback</Badge>
                  ) : (
                    <Badge status="success">Transcript</Badge>
                  )
                }
              >
                <p>{output.overview}</p>
              </Card>

              <Card title="Concise Detailed Bullets" subtitle="Judge-friendly walkthrough points">
                <ul className="youtube-bullet-list">
                  {output.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </Card>

              <Card title="Key Concepts" subtitle="High-signal concepts extracted from the video">
                <div className="chip-row">
                  {output.concepts.map((concept) => (
                    <Chip key={concept} tone="brand">
                      {concept}
                    </Chip>
                  ))}
                </div>
              </Card>

              <Card title="Suggested Revision Cards" subtitle="Use these for next retention cycle">
                <div className="youtube-revision-grid">
                  {output.revisionCards.map((card) => (
                    <article key={card.id} className="youtube-revision-card">
                      <h3>{card.title}</h3>
                      <p className="muted-copy">{card.why}</p>
                      <p>{card.prompt}</p>
                    </article>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  )
}

export default YouTubeExplainerPage
