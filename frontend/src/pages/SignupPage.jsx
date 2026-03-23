import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Chip from '../components/ui/Chip.jsx'

function SignupPage() {
  const navigate = useNavigate()
  const { signup, loading, isAuthenticated } = useAuth()

  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (formState.fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.')
      return
    }

    if (formState.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (formState.password !== formState.confirmPassword) {
      setError('Password and confirm password do not match.')
      return
    }

    const result = await signup(formState)

    if (result.ok) {
      navigate('/dashboard')
      return
    }

    setError(result.message)
  }

  return (
    <div className="auth-layout">
      <Card
        className="auth-card"
        title="Create Account"
        subtitle="Set up your learner profile in less than a minute. Password must be 8+ characters."
        action={<Chip tone="brand">MVP Flow</Chip>}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Full Name
            <input
              type="text"
              value={formState.fullName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, fullName: event.target.value }))
              }
              required
            />
          </label>

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

          <label>
            Confirm Password
            <input
              type="password"
              value={formState.confirmPassword}
              onChange={(event) =>
                setFormState((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              required
            />
          </label>

          <Button type="submit" loading={loading}>
            Create Account
          </Button>

          {error ? <p className="form-error">{error}</p> : null}

          <p className="auth-meta">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}

export default SignupPage
