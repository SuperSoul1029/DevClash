import { Link } from 'react-router-dom'

function AboutPage() {
  return (
    <div className="public-info-page">
      <section className="public-info-card">
        <h1>About Us</h1>
        <p>
          DevClash is a focused learning platform built to help students learn deeply, revise consistently, and perform with confidence.
        </p>
        <div className="public-info-actions">
          <Link className="btn btn--ghost" to="/">Back Home</Link>
          <Link className="btn btn--primary" to="/signup">Get Started</Link>
        </div>
      </section>
    </div>
  )
}

export default AboutPage
