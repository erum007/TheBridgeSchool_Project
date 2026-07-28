export function formatApiError(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail

  if (Array.isArray(detail)) {
    const message = detail.map((item) => item?.msg || String(item)).filter(Boolean).join('. ')
    return message || fallback
  }

  if (detail && typeof detail === 'object') {
    return detail.message || fallback
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (error?.message === 'Network Error') {
    return 'Could not reach the server. Start the backend with: python -m uvicorn backend.main:app --reload --port 8000'
  }

  return fallback
}

export function isValidPortalPassword(password) {
  return (
    password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  )
}
