import { useEffect, useRef } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function useWebPush(userId: string | undefined) {
  const registered = useRef(false)

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !VAPID_PUBLIC_KEY) return
    if (registered.current) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const register = async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          console.log('[WebPush] Permissão negada.')
          return
        }

        const registration = await navigator.serviceWorker.ready

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        const sub = subscription.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } }

        const supabase = getSupabase()
        if (!supabase) return

        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: sub.endpoint,
            subscription: sub,
          },
          { onConflict: 'user_id,endpoint' }
        )

        if (error) {
          console.error('[WebPush] Erro ao salvar subscription:', error.message)
        } else {
          console.log('[WebPush] Subscription registrada com sucesso.')
          registered.current = true
        }
      } catch (e) {
        console.error('[WebPush] Erro ao registrar:', e)
      }
    }

    void register()
  }, [userId])
}
