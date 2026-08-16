import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { authApi } from '../api/auth.js'
import { setApiToken } from '../api/axios.js'
import { browserPushSupported, registerBrowserPush } from '../utils/webPush.js'
import { isCordova, registerNativePush, removeNativePush, secureGet, secureRemove, secureSet } from '../utils/native.js'

const AuthContext = createContext(null)

const tokenKey = 'bridge_school_token'
const userKey = 'bridge_school_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    let active = true
    const localToken = window.localStorage.getItem(tokenKey)
    const restoreCurrentUser = async () => {
      const storedToken = isCordova() ? (await secureGet(tokenKey) || localToken) : localToken
      if (!storedToken) {
        if (active) setInitialising(false)
        return
      }
      setApiToken(storedToken)
      if (active) setToken(storedToken)
      if (isCordova() && localToken) {
        secureSet(tokenKey, localToken)
        window.localStorage.removeItem(tokenKey)
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
          setApiToken(null)
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
    setApiToken(nextToken)
    setUser(nextUser)
    if (!isCordova()) window.localStorage.setItem(tokenKey, nextToken)
    window.localStorage.setItem(userKey, JSON.stringify(nextUser))
    secureSet(tokenKey, nextToken)
    // A push subscription belongs to this browser profile. Re-associate it on
    // every login so a shared browser only delivers to the latest account.
    if (isCordova()) {
      registerNativePush(false).catch(() => {})
    } else if (browserPushSupported() && Notification.permission === 'granted') {
      registerBrowserPush().catch(() => {})
    }
    return nextUser
  }

  const logout = () => {
    removeNativePush()
    setToken(null)
    setApiToken(null)
    setUser(null)
    window.localStorage.removeItem(tokenKey)
    window.localStorage.removeItem(userKey)
    secureRemove(tokenKey)
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
