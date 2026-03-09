import { useEffect, useRef, useState } from 'react'
import Pusher from 'pusher-js'

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY ?? '37548be72fd285fe2963'
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER ?? 'sa1'

export interface PusherNotification {
  type: string
  message?: string
  count?: number
  data?: unknown
}

/**
 * Subscreve ao canal do usuário no Pusher e retorna a última notificação recebida.
 * Canal: user-${userId} ou 'my-channel' se userId não informado.
 * Eventos: 'due-transactions' | 'my-event'
 */
export function usePusher(userId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false
  const [lastNotification, setLastNotification] = useState<PusherNotification | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null)

  useEffect(() => {
    if (!enabled) return
    const channelName = userId ? `user-${userId}` : 'my-channel'
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    })
    pusherRef.current = pusher
    const channel = pusher.subscribe(channelName)
    channelRef.current = channel

    const handler = (data: unknown) => {
      const payload =
        typeof data === 'object' && data !== null
          ? (data as { type?: string; message?: string; count?: number; data?: unknown })
          : {}
      setLastNotification({
        type: payload.type ?? 'notification',
        message: payload.message,
        count: payload.count,
        data: payload.data ?? data,
      })
    }

    channel.bind('due-transactions', handler)
    channel.bind('my-event', handler)
    channel.bind('subscription-activated', handler)
    channel.bind('subscription-canceled', handler)

    return () => {
      channel.unbind('due-transactions', handler)
      channel.unbind('my-event', handler)
      channel.unbind('subscription-activated', handler)
      channel.unbind('subscription-canceled', handler)
      pusher.unsubscribe(channelName)
      pusher.disconnect()
      pusherRef.current = null
      channelRef.current = null
    }
  }, [enabled, userId])

  return { lastNotification, clearNotification: () => setLastNotification(null) }
}
