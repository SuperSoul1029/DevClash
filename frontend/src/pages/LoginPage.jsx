import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, loading } = useAuth()

  const [formState, setFormState] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const fromPath = location.state?.from?.pathname || '/dashboard'

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const result = await login(formState)

    if (!result.ok) {
      setError(result.message)
      return
    }

    navigate(fromPath, { replace: true })
  }

  return (
    <div className="auth-layout">
      <Card
        className="auth-card"
        title="Welcome Back"
        subtitle="Sign in to continue your study session."
        action={<Badge status="success">Demo Ready</Badge>}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={formState.email}
              onChange={(event) =>
                setFormState((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={formState.password}
              onChange={(event) =>
                setFormState((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <Button type="submit" loading={loading}>
            Sign In
          </Button>

          <p className="auth-meta">
            New here? <Link to="/signup">Create your account</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}

export default LoginPage
