import AuthProvider from '../context/AuthContext.jsx'
import LearningProvider from '../context/LearningContext.jsx'

function AppProviders({ children }) {
  return (
    <AuthProvider>
      <LearningProvider>{children}</LearningProvider>
    </AuthProvider>
  )
}

export default AppProviders
