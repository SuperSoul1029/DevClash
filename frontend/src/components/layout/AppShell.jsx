import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import Button from '../ui/Button.jsx'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Mind Map', to: '/mindmap' },
  { label: 'Topic Tracker', to: '/topics' },
  { label: 'Practice', to: '/practice' },
  { label: 'Test Center', to: '/tests' },
  { label: 'YouTube Explainer', to: '/youtube' },
  { label: 'Chat Bot', to: '/tutor' },
]

function AppShell({ children }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">DC</span>
          <div>
            <p className="brand__name">DevClash</p>
            <p className="brand__tag">Learning Intelligence</p>
          </div>
        </div>

        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((value) => !value)}
        >
          Menu
        </button>

        <nav id="primary-nav" className={`topnav ${menuOpen ? 'topnav--open' : ''}`}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
              }
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar__right">
          <p className="user-pill">{user?.fullName ?? 'Guest'}</p>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  )
}

export default AppShell
