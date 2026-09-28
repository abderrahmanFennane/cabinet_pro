import { useEffect, useRef } from 'react'
import i18n from './i18n'
import { useAuth } from './lib/hooks'
import AppRouter from './router'
import SubscriptionBlocked from './pages/SubscriptionBlocked'

const IDLE_LIMIT_MS = 15 * 60 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** NFR: the session locks after 15 minutes without activity, to protect patient data on shared screens. */
function useIdleLock(active: boolean, onIdle: () => void) {
  // Kept in a ref so re-renders (queries refetch every few seconds) never restart the countdown.
  const callback = useRef(onIdle)
  callback.current = onIdle
  useEffect(() => {
    if (!active) return
    const fire = () => callback.current()
    let timer = window.setTimeout(fire, IDLE_LIMIT_MS)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(fire, IDLE_LIMIT_MS)
    }
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, reset))
    }
  }, [active])
}

export default function App() {
  const { loading, user, isAuthenticated, logout } = useAuth()

  useIdleLock(isAuthenticated, () => {
    sessionStorage.setItem('authError', i18n.t('lock.description'))
    logout()
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated && user?.blocked) return <SubscriptionBlocked />

  return <AppRouter />
}
