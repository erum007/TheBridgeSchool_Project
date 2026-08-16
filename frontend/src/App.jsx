import { useEffect, useState } from 'react'
import AppRouter from './routes/AppRouter.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'
import { SkeletonStyle } from './components/shared/Skeleton.jsx'

function App() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])
  return (
    <AppErrorBoundary>
      <SkeletonStyle />
      {!online ? <div role="status" className="fixed inset-x-0 top-0 z-[100] bg-amber-600 px-3 py-2 text-center text-sm font-medium text-white">You are offline. Changes and live data will resume when your connection returns.</div> : null}
      <AppRouter />
    </AppErrorBoundary>
  )
}

export default App
