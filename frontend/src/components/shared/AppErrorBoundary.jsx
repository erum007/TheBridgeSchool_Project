import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Portal view rendering failed', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] p-6">
          <div className="max-w-md rounded-xl border border-[var(--border-default)] bg-white p-6 text-center shadow-sm">
            <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">This page could not load</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">The portal is still available. Return to the dashboard and try again.</p>
            <a href={window.cordova ? '#/' : '/'} className="portal-button-primary mt-5 inline-flex">Return to dashboard</a>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
