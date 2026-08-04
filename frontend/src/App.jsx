import AppRouter from './routes/AppRouter.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'
import { SkeletonStyle } from './components/shared/Skeleton.jsx'

function App() {
  return (
    <AppErrorBoundary>
      <SkeletonStyle />
      <AppRouter />
    </AppErrorBoundary>
  )
}

export default App