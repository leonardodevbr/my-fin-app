/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ─── Web Push ────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as {
    title?: string
    body?: string
    url?: string
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'NunFí', {
      body: data.body ?? 'Você tem contas a pagar!',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'due-transactions',
      data: { url: data.url ?? '/#/transactions' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow(event.notification.data?.url ?? '/')
      })
  )
})
