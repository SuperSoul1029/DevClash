import { Link } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'

function NotFoundPage() {
  return (
    <div className="auth-layout">
      <Card title="Route Not Found" subtitle="This path does not exist in the current MVP scope.">
        <p className="empty-copy">Use the navigation to return to a valid page.</p>
        <Link to="/" className="inline-link">
          <Button>Go Home</Button>
        </Link>
      </Card>
    </div>
  )
}

export default NotFoundPage
