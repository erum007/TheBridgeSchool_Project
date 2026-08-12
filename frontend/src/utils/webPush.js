import { pushApi } from '../api/push.js'

const base64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0))
}

export const browserPushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function registerBrowserPush() {
  if (!browserPushSupported()) throw new Error('This browser does not support device notifications')
  await navigator.serviceWorker.register('/push-sw.js')
  // A newly installed worker is not necessarily active yet. Subscribing
  // against the active registration guarantees it can be started later to
  // handle a push after the portal window has been closed.
  const registration = await navigator.serviceWorker.ready
  const keyResponse = await pushApi.publicKey()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(keyResponse.data.public_key) })
  await pushApi.subscribe(subscription.toJSON())
  return subscription
}

export async function removeBrowserPush() {
  if (!browserPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await pushApi.unsubscribe(subscription.toJSON())
}
