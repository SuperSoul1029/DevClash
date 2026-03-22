const TOKEN_KEY = 'devclash-auth-token'
const USER_KEY = 'devclash-auth-user'

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setStoredUser(user) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  window.localStorage.removeItem(USER_KEY)
}
