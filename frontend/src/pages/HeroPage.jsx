import { Link, useNavigate } from 'react-router-dom'
import Galaxy from '../components/Galaxy.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function HeroPage() {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()

  const handleLogoutFromLanding = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="hero-landing">
      <div className="hero-landing__bg" aria-hidden="true">
        <Galaxy
          hueShift={212}
          density={1.05}
          glowIntensity={0.42}
          starSpeed={0.58}
          speed={1.08}
          twinkleIntensity={0.72}
          rotationSpeed={0.12}
          repulsionStrength={2.1}
          autoCenterRepulsion={0.15}
          transparent
        />
      </div>

      <div className="hero-landing__top-left">
        <Link className="hero-mini-btn" to="/contact">Contact</Link>
        <Link className="hero-mini-btn" to="/about">About Us</Link>
      </div>

      <section className="hero-landing__center">
        <p className="hero-landing__eyebrow">DevClash Learning Intelligence</p>
        <h1>Master concepts faster. Retain them longer.</h1>
        <p>
          Smart tracking, adaptive revision, and test-driven progress for students who want consistent wins.
        </p>
        <div className="hero-landing__actions">
          {isAuthenticated ? (
            <>
              <Link className="btn btn--primary" to="/dashboard">Go to Dashboard</Link>
              <button type="button" className="btn btn--ghost" onClick={handleLogoutFromLanding}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--primary" to="/login">Sign In</Link>
              <Link className="btn btn--ghost" to="/signup">Sign Up</Link>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default HeroPage
