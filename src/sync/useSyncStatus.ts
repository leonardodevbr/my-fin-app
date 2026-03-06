import { useCallback, useEffect, useState } from 'react'
import { startAutoSync, getLastSyncTime, syncAll, clearLastSync } from './syncEngine'

export interface SyncStatus {
  syncing: boolean
  last_synced: string | null
  error: string | null
}

export function useSyncStatus(): SyncStatus & {
  refetch: () => void
  syncNow: () => Promise<void>
  /** Força novo pull completo (útil quando categorias/contas não aparecem). */
  forceFullSync: () => Promise<void>
} {
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(() => getLastSyncTime() || null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLastSynced(getLastSyncTime() || null)
  }, [])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncAll()
      setLastSynced(getLastSyncTime() || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }, [])

  const forceFullSync = useCallback(async () => {
    clearLastSync()
    await syncNow()
  }, [syncNow])

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
    syncNow,
    forceFullSync,
  }
}

export async function triggerSync(): Promise<void> {
  await syncAll()
}
