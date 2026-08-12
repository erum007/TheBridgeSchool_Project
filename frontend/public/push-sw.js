self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'The Bridge School', {
    body: data.body || '', icon: '/favicon.svg', badge: '/favicon.svg',
    // Keep a reminder visible in the system notification centre rather than
    // allowing desktop browsers to immediately collapse it after delivery.
    requireInteraction: true,
    renotify: true,
    tag: data.tag || `bridge-notification-${Date.now()}`,
    data: { link: data.link || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.link || '/'))
})
