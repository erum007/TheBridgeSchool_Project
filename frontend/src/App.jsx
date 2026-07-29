import AppRouter from './routes/AppRouter.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'

function App() {
  return <AppErrorBoundary><AppRouter /></AppErrorBoundary>
}

export default App
