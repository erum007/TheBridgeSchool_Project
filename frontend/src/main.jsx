import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
