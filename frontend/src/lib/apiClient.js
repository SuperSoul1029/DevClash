import { getStoredToken } from './authStorage.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    ...(options.headers || {}),
  }

  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body:
        options.body !== undefined && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body,
    })
  } catch (error) {
    throw new ApiError(
      'Cannot reach backend API. Ensure backend is running and VITE_API_BASE_URL is correct.',
      0,
      { cause: error?.message || 'network_error' },
    )
  }

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    const details = Array.isArray(payload?.details)
      ? payload.details
          .map((item) => item?.message)
          .filter(Boolean)
          .join(', ')
      : ''

    const baseMessage =
      payload?.message || payload?.error?.message || `Request failed (${response.status})`
    const message = details ? `${baseMessage}: ${details}` : baseMessage
    throw new ApiError(message, response.status, payload)
  }

  return payload
}
