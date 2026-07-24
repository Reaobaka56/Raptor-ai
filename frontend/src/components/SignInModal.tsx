import { useState, useEffect, useRef } from 'react'
import { Github, X, Loader2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface SignInModalProps {
  onClose: () => void
  onLogin: () => Promise<void>
}

export default function SignInModal({ onClose, onLogin }: SignInModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleLogin = async () => {
    if (!agreed || loading) return
    setLoading(true)
    setError('')
    try {
      await onLogin()
    } catch {
      setError('Authentication failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="modal-card w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Github className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Sign in to Raptor AI</p>
              <p className="text-xs text-gray-500">Connect your GitHub account</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-gray-500 hover:text-white hover:border-white/30 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* GitHub button */}
          <button
            onClick={handleLogin}
            disabled={!agreed || loading}
            className={`flex w-full items-center justify-center gap-3 rounded-xl border py-3 text-sm font-bold transition-all ${
              agreed && !loading
                ? 'border-white bg-white text-black hover:bg-gray-100 cursor-pointer'
                : 'border-white/10 bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            {loading ? 'Connecting to GitHub…' : 'Continue with GitHub'}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 flex-none" />
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/8" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0d0d14] px-3 text-xs text-gray-600">By continuing</span>
            </div>
          </div>

          {/* ToS checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div className={`h-4 w-4 rounded border flex-none flex items-center justify-center transition-colors ${
                agreed ? 'border-white bg-white' : 'border-white/20 bg-white/5 group-hover:border-white/40'
              }`}>
                {agreed && (
                  <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              I agree to Raptor AI's{' '}
              <Link to="/terms" onClick={onClose} className="text-white hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" onClick={onClose} className="text-white hover:underline">Privacy Policy</Link>
              . I understand that Raptor will access my GitHub repositories to perform code reviews.
            </p>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t border-white/8 px-6 py-4">
          <p className="text-[11px] text-gray-600 text-center">
            Raptor never stores your code. Diffs are analysed in memory and discarded after each review.
          </p>
        </div>
      </div>
    </div>
  )
}
