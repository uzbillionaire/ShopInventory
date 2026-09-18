import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, onTokensChange, tokens } from './api/client'

interface Auth {
  loggedIn: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [loggedIn, setLoggedIn] = useState(() => tokens.get() !== null)

  useEffect(
    () =>
      onTokensChange((value) => {
        setLoggedIn(value !== null)
        if (!value) client.clear()
      }),
    [client],
  )

  const value = useMemo<Auth>(() => ({ loggedIn, login: apiLogin, logout: apiLogout }), [loggedIn])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
