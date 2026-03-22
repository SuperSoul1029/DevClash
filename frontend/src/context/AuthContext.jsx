import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest, ApiError } from '../lib/apiClient.js'
import {
  clearStoredToken,
  clearStoredUser,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../lib/authStorage.js'

const AuthContext = createContext(null)

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      setInitializing(false)
      return
    }

    let cancelled = false

    async function bootstrapAuth() {
      try {
        const payload = await apiRequest('/api/auth/me')
        if (cancelled) return

        setUser(payload.user)
        setStoredUser(payload.user)
      } catch {
        if (cancelled) return

        clearStoredToken()
        clearStoredUser()
        setUser(null)
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    bootstrapAuth()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async ({ email, password }) => {
    setLoading(true)

    try {
      const payload = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          password,
        },
      })

      setStoredToken(payload.token)
      setStoredUser(payload.user)
      setUser(payload.user)

      return { ok: true }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Unable to sign in right now.'
      return { ok: false, message }
    } finally {
      setLoading(false)
    }
  }

  const signup = async ({ fullName, email, password }) => {
    setLoading(true)

    try {
      const payload = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      })

      setStoredToken(payload.token)
      setStoredUser(payload.user)
      setUser(payload.user)

      return { ok: true }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Unable to create account right now.'
      return { ok: false, message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearStoredToken()
    clearStoredUser()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
    }),
    [user, loading, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

export default AuthProvider
