import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { School } from 'lucide-react'

import { useAuth } from '../../context/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })

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

  const handleForgotPassword = () => {
    toast('Password reset is not wired yet. Please contact an admin.')
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
            <button type="button" className="text-sm font-medium text-[var(--brand-red)] hover:text-[var(--brand-red-dark)]" onClick={handleForgotPassword}>
              Forgot Password?
            </button>
            <button type="submit" className="portal-button-primary w-full">Sign In</button>
          </form>
        </div>
      </main>
    </div>
  )
}
