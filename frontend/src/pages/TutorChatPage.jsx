import { useState } from 'react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { apiRequest } from '../lib/apiClient.js'

function TutorChatPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedQuestion = question.trim()
    if (normalizedQuestion.length < 5) {
      setError('Please enter a more detailed question (at least 5 characters).')
      return
    }

    setError('')
    setLoading(true)

    try {
      const payload = await apiRequest('/api/tutor/query', {
        method: 'POST',
        body: {
          question: normalizedQuestion,
        },
      })

      setResponse(payload.response || null)
    } catch (apiError) {
      setError(apiError.message || 'Unable to get tutor response right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-grid">
      <h1 className="topic-tracker-title">Chat Bot</h1>

      <section>
        <Card
          subtitle={<span className="tutor-subtitle-dark">Send your doubt to tutor</span>}
          action={
            response ? (
              <Badge status={response.abstained ? 'warning' : 'success'}>
                {response.abstained ? 'Low Confidence' : `Confidence ${Math.round((response.confidence || 0) * 100)}%`}
              </Badge>
            ) : null
          }
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              <textarea
                rows={5}
                placeholder="Ask your doubt..."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <div className="inline-actions">
              <Button type="submit" disabled={loading}>
                {loading ? 'Asking...' : 'Ask Chat Bot'}
              </Button>
            </div>
          </form>

          <div className="tutor-response-grid action-row">
            {!response ? (
              <p className="empty-copy">Send a question to see a response here.</p>
            ) : (
              <>
                <p className="tutor-answer">{response.answer}</p>

                <div className="tutor-citations">
                  <h3>Citations</h3>
                  {response.citations?.length ? (
                    <ol>
                      {response.citations.map((citation, index) => (
                        <li key={citation.id || `${citation.label}-${index}`}>
                          {citation.sourceUrl ? (
                            <a href={citation.sourceUrl} target="_blank" rel="noreferrer">
                              {citation.label}
                            </a>
                          ) : (
                            citation.label
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted-copy">No citations returned.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}

export default TutorChatPage
