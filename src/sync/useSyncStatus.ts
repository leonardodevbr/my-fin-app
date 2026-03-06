import { useCallback, useEffect, useState } from 'react'
import { startAutoSync, getLastSyncTime, syncAll } from './syncEngine'

export interface SyncStatus {
  syncing: boolean
  last_synced: string | null
  error: string | null
}

export function useSyncStatus(): SyncStatus & { refetch: () => void } {
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(() => getLastSyncTime() || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLastSynced(getLastSyncTime() || null)
  }, [])

  useEffect(() => {
    const stop = startAutoSync((isSyncing, err) => {
      setSyncing(isSyncing)
      setError(err ?? null)
      if (!isSyncing) setLastSynced(getLastSyncTime() || null)
    })
    return stop
  }, [])

  return {
    syncing,
    last_synced: lastSynced || null,
    error,
    refetch,
  }
}

export async function triggerSync(): Promise<void> {
  await syncAll()
}
