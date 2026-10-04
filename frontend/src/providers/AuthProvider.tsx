import { createContext, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Role, User } from '../types'
import { PermissionKey } from '../types/permissions'

interface AuthContextType {
  user: User | null
  loading: boolean
  /** Returns the second step to show when the account uses two-step login. */
  login: (email: string, password: string) => Promise<MfaChallenge | null>
  /** Stores a session token (end of the two-step login) and loads the profile. */
  startSession: (token: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  hasRole: (roles: Role | Role[]) => boolean
  hasPermissions: (permissions: PermissionKey | PermissionKey[]) => boolean
  isAuthenticated: boolean
}

export interface MfaChallenge {
  mfa: 'SETUP' | 'VERIFY'
  mfaToken: string
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.data || data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null)
      setLoading(false)
      // Public pages (home page, document shared with a patient) stay where they are.
      const path = window.location.pathname
      if (path !== '/admin' && path !== '/' && !path.startsWith('/d/')) {
        navigate('/admin', { replace: true })
      }
    }
    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [navigate])

  useEffect(() => {
    const handleAuthRefresh = () => {
      void fetchMe()
    }
    window.addEventListener('auth:refresh', handleAuthRefresh)
    return () => window.removeEventListener('auth:refresh', handleAuthRefresh)
  }, [fetchMe])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (data.data?.mfa) {
        setLoading(false)
        return data.data as MfaChallenge
      }
      const token = data.token || data.data?.token
      if (token) {
        localStorage.setItem('token', token)
      }
      await fetchMe()
      return null
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const startSession = async (token: string) => {
    localStorage.setItem('token', token)
    setLoading(true)
    await fetchMe()
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/admin', { replace: true })
  }

  const hasRole = (roles: Role | Role[]) => {
    if (!user) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(user.role)
  }

  const hasPermissions = (permissions: PermissionKey | PermissionKey[]) => {
    if (!user) return false
    if (user.role === Role.SUPER_ADMIN) return true
    const userPerms = (user.permissions || []) as PermissionKey[]
    const required = Array.isArray(permissions) ? permissions : [permissions]
    return required.every(p => userPerms.includes(p))
  }

  const isAuthenticated = !!user && !!localStorage.getItem('token')

  return (
    <AuthContext.Provider
      value={{ user, loading, login, startSession, logout, fetchMe, hasRole, hasPermissions, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  )
}
