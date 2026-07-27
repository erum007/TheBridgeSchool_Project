import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { authApi } from '../api/auth.js'

const AuthContext = createContext(null)

const tokenKey = 'bridge_school_token'
const userKey = 'bridge_school_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    let active = true
    const storedToken = window.localStorage.getItem(tokenKey)
    const storedUser = window.localStorage.getItem(userKey)
    if (storedToken) setToken(storedToken)
    if (storedUser && !storedToken) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        window.localStorage.removeItem(userKey)
      }
    }
    const restoreCurrentUser = async () => {
      if (!storedToken) {
        if (active) setInitialising(false)
        return
      }
      try {
        const currentUser = (await authApi.me()).data
        if (active) {
          setUser(currentUser)
          window.localStorage.setItem(userKey, JSON.stringify(currentUser))
        }
      } catch {
        if (active) {
          setToken(null)
          setUser(null)
          window.localStorage.removeItem(tokenKey)
          window.localStorage.removeItem(userKey)
        }
      } finally {
        if (active) setInitialising(false)
      }
    }
    restoreCurrentUser()
    return () => { active = false }
  }, [])

  const login = async (payload) => {
    const response = await authApi.login(payload)
    const nextToken = response.data.access_token
    const nextUser = response.data.user
    setToken(nextToken)
    setUser(nextUser)
    window.localStorage.setItem(tokenKey, nextToken)
    window.localStorage.setItem(userKey, JSON.stringify(nextUser))
    return nextUser
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    window.localStorage.removeItem(tokenKey)
    window.localStorage.removeItem(userKey)
  }

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role ?? null,
      initialising,
      login,
      logout,
      setUser,
      refreshUser: async () => {
        const nextUser = (await authApi.me()).data
        setUser(nextUser)
        window.localStorage.setItem(userKey, JSON.stringify(nextUser))
        return nextUser
      },
    }),
    [initialising, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
