import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initialiseNativeRuntime } from './utils/native.js'

const router = import.meta.env.VITE_CORDOVA === 'true' ? HashRouter : BrowserRouter
initialiseNativeRuntime().catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {createElement(router, null,
      <AuthProvider>
        <AppErrorBoundary>
          <App />
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#ffffff',
              border: '1px solid #e2e5f0',
              color: '#1a1f36',
              boxShadow: 'none',
              fontFamily: 'Inter, sans-serif',
            },
            success: {
              style: { border: '1px solid #b8ddb8' },
              iconTheme: { primary: '#2d7a2d', secondary: '#ffffff' },
            },
            error: {
              style: { border: '1px solid #f5c6c2' },
              iconTheme: { primary: '#C0392B', secondary: '#ffffff' },
            },
          }}
        />
        </AppErrorBoundary>
      </AuthProvider>,
    )}
  </StrictMode>,
)
