import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { School } from 'lucide-react'

import { useAuth } from '../../context/AuthContext.jsx'
import { authApi } from '../../api/auth.js'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    try {
      const user = await login(form)
      const nextPath =
        user.role === 'admin'
          ? '/admin/dashboard'
          : user.role === 'teacher'
            ? '/teacher/dashboard'
            : user.role === 'student'
              ? '/student/home'
              : '/parent/home'
      navigate(nextPath)
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Login failed')
    }
  }

  const handleForgotPassword = async (event) => {
    event.preventDefault()
    try {
      await authApi.forgotPassword(resetEmail)
      toast.success('Reset link sent if account exists')
      setShowForgotPassword(false)
      setResetEmail('')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not send reset link')
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden min-h-screen bg-[var(--brand-navy)] px-12 py-10 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-[var(--brand-navy)]">
            <School className="h-10 w-10" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold text-white">Bridge School Portal</h1>
          <p className="mt-3 max-w-sm text-sm text-[var(--sidebar-text)]">
            A connected workspace for learning, communication, and school operations.
          </p>
        </div>
        <p className="absolute bottom-10 max-w-md text-center text-sm italic text-[var(--sidebar-label)]">
          Building bridges between students, families, and educators.
        </p>
      </section>

      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--brand-navy)] text-white">
              <School className="h-7 w-7" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Welcome back</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Sign in to your account.</p>
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <div>
              <label className="portal-label">Email</label>
              <input
                className="portal-input mt-1"
                placeholder="school.email@example.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div>
              <label className="portal-label">Password</label>
              <input
                type="password"
                className="portal-input mt-1"
                placeholder="enter your password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
            {showForgotPassword ? (
              <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-4">
                <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">Enter your email to receive a reset link</p>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-[var(--border-default)] px-3 py-2.5 text-sm focus:border-[var(--brand-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]/10"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={handleForgotPassword} className="portal-button-primary px-4 py-2 text-sm">Send Reset Link</button>
                  <button type="button" onClick={() => setShowForgotPassword(false)} className="portal-button-secondary px-4 py-2 text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-[var(--brand-red)] hover:underline">Forgot password?</button>
            )}
            <button type="submit" className="portal-button-primary w-full">Sign In</button>
          </form>
        </div>
      </main>
    </div>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [form, setForm] = useState({ new_password: '', confirm_password: '' })

  const submit = async (event) => {
    event.preventDefault()
    if (!form.new_password || form.new_password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await authApi.resetPassword(token, form.new_password)
      toast.success('Password reset successfully')
      navigate('/login')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not reset password')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
      <form className="w-full max-w-md space-y-4" onSubmit={submit}>
        <h1 className="font-display text-2xl font-bold text-[var(--brand-navy)]">Reset Password</h1>
        <input type="password" className="portal-input" placeholder="New password" value={form.new_password} onChange={(event) => setForm({ ...form, new_password: event.target.value })} />
        <input type="password" className="portal-input" placeholder="Confirm password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} />
        <button type="submit" className="portal-button-primary w-full">Reset Password</button>
      </form>
    </div>
  )
}
