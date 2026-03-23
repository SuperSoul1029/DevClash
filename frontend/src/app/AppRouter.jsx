import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AppShell from '../components/layout/AppShell.jsx'
import HeroPage from '../pages/HeroPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import TopicTrackerPage from '../pages/TopicTrackerPage.jsx'
import TestCenterPage from '../pages/TestCenterPage.jsx'
import PracticePage from '../pages/PracticePage.jsx'
import YouTubeExplainerPage from '../pages/YouTubeExplainerPage.jsx'
import MindMapPage from '../pages/MindMapPage.jsx'
import TutorChatPage from '../pages/TutorChatPage.jsx'
import AboutPage from '../pages/AboutPage.jsx'
import ContactPage from '../pages/ContactPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import SignupPage from '../pages/SignupPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'

function ProtectedLayout() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function GuestOnly({ children }) {
  const { isAuthenticated, initializing } = useAuth()

  if (initializing) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />

      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignupPage />
          </GuestOnly>
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/topics" element={<TopicTrackerPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/tests" element={<TestCenterPage />} />
        <Route path="/youtube" element={<YouTubeExplainerPage />} />
        <Route path="/mindmap" element={<MindMapPage />} />
        <Route path="/tutor" element={<TutorChatPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
