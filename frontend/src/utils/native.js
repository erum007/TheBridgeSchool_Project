import { pushApi } from '../api/push.js'

export const isCordova = () => Boolean(window.cordova)

export const whenDeviceReady = () => new Promise((resolve) => {
  if (!isCordova() || window.__bridgeDeviceReady) return resolve()
  document.addEventListener('deviceready', () => {
    window.__bridgeDeviceReady = true
    resolve()
  }, { once: true })
})

const firebase = () => window.FirebasexMessaging || window.FirebasePlugin

const firebaseCall = (method, ...args) => new Promise((resolve, reject) => {
  const plugin = firebase()
  if (!plugin?.[method]) return reject(new Error('Native notifications are unavailable'))
  plugin[method](resolve, reject, ...args)
})

export async function nativePushStatus() {
  if (!isCordova()) return 'unsupported'
  await whenDeviceReady()
  if (!firebase()) return 'unsupported'
  try {
    return (await firebaseCall('hasPermission')) ? 'granted' : 'default'
  } catch {
    return 'default'
  }
}

export async function registerNativePush(requestPermission = false) {
  await whenDeviceReady()
  if (!firebase()) throw new Error('Native notifications are unavailable')
  if (requestPermission) await firebaseCall('grantPermission')
  const token = await firebaseCall('getToken')
  if (!token) throw new Error('Firebase did not return a device token')
  await pushApi.registerDevice(token)
  return token
}

export async function removeNativePush() {
  if (!isCordova() || !firebase()) return
  try {
    const token = await firebaseCall('getToken')
    if (token) await pushApi.unregisterDevice(token)
  } catch {
    // Logout must still complete when the device is offline.
  }
}

export async function initialiseNativeRuntime() {
  if (!isCordova()) return
  await whenDeviceReady()
  firebase()?.onTokenRefresh?.((token) => pushApi.registerDevice(token).catch(() => {}), () => {})
  firebase()?.onMessageReceived?.((message) => {
    const link = message?.link
    if (message?.tap && link) window.location.hash = `#${link.startsWith('/') ? link : `/${link}`}`
  }, () => {})
  document.addEventListener('backbutton', () => {
    if (window.location.hash && !window.location.hash.endsWith('/login')) window.history.back()
    else window.navigator.app?.exitApp?.()
  })
}

export function openExternal(url) {
  if (isCordova() && window.cordova?.InAppBrowser) {
    window.cordova.InAppBrowser.open(url, '_system')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const writeCordovaFile = (directory, filename, blob) => new Promise((resolve, reject) => {
  window.resolveLocalFileSystemURL(directory, (directoryEntry) => {
    directoryEntry.getFile(filename, { create: true }, (fileEntry) => {
      fileEntry.createWriter((writer) => {
        writer.onwriteend = () => resolve(fileEntry.nativeURL)
        writer.onerror = reject
        writer.write(blob)
      }, reject)
    }, reject)
  }, reject)
})

export async function saveFile(blob, filename, mimeType = blob.type || 'application/octet-stream') {
  if (!isCordova()) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  await whenDeviceReady()
  if (!window.cordova?.file) throw new Error('File storage is unavailable')
  const nativeUrl = await writeCordovaFile(window.cordova.file.externalDataDirectory, filename, blob)
  await new Promise((resolve, reject) => window.cordova.plugins.fileOpener2.open(nativeUrl, mimeType, { success: resolve, error: reject }))
}

export function secureSet(key, value) {
  if (!isCordova() || !window.cordova?.plugins?.SecureStorage) return
  const store = new window.cordova.plugins.SecureStorage(() => store.set(() => {}, () => {}, key, value), () => {}, 'bridge_school')
}

export async function secureGet(key) {
  if (!isCordova()) return null
  await whenDeviceReady()
  if (!window.cordova?.plugins?.SecureStorage) return null
  return new Promise((resolve) => {
    const store = new window.cordova.plugins.SecureStorage(
      () => store.get(resolve, () => resolve(null), key),
      () => resolve(null),
      'bridge_school',
    )
  })
}

export function secureRemove(key) {
  if (!isCordova() || !window.cordova?.plugins?.SecureStorage) return
  const store = new window.cordova.plugins.SecureStorage(() => store.remove(() => {}, () => {}, key), () => {}, 'bridge_school')
}
