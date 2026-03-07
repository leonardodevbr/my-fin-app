import { useEffect, useRef } from 'react'
import { scheduleRecurringTransactions } from './recurringScheduler'

const THROTTLE_MS = 60 * 60 * 1000 // 1 hour

export function RecurringSchedulerInit() {
  const lastRun = useRef<number>(0)

  useEffect(() => {
    void scheduleRecurringTransactions()
    lastRun.current = Date.now()

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRun.current < THROTTLE_MS) return
      lastRun.current = Date.now()
      void scheduleRecurringTransactions()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return null
}
