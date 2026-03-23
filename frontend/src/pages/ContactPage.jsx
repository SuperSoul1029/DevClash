import { Link } from 'react-router-dom'

function ContactPage() {
  return (
    <div className="public-info-page">
      <section className="public-info-card">
        <h1>Contact</h1>
        <p>
          Reach the DevClash team at support@devclash.app for platform questions, demos, or partnership inquiries.
        </p>
        <div className="public-info-actions">
          <Link className="btn btn--ghost" to="/">Back Home</Link>
          <Link className="btn btn--primary" to="/login">Sign In</Link>
        </div>
      </section>
    </div>
  )
}

export default ContactPage
