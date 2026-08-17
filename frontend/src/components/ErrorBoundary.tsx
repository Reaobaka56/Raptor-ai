import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it in the console with the component stack — without this,
    // a caught render error prints nothing and just looks like a silent
    // blank screen in prod builds.
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d14] p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-500/20">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Something went wrong</h2>
            <p className="mt-1 text-sm text-gray-500">
              This page hit an error and couldn't render. Reloading usually fixes it.
            </p>
          </div>
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-mono text-gray-500 break-words">
            {this.state.error.message}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="mx-auto flex items-center gap-2 rounded border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition"
          >
            <RotateCcw className="h-4 w-4" /> Reload
          </button>
        </div>
      </div>
    )
  }
}
