import { BrowserRouter } from 'react-router-dom'
import AppProviders from './app/AppProviders.jsx'
import AppRouter from './app/AppRouter.jsx'

function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  )
}

export default App
