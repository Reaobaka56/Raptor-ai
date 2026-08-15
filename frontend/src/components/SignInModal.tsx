import { useState, useEffect, useRef } from 'react'
import { Github, X, Loader2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface SignInModalProps {
  onClose: () => void
  onLogin: () => Promise<void>
}

export default function SignInModal({ onClose, onLogin }: SignInModalProps) {
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
    if (loading) return
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
      className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-black p-8 shadow-[0_32px_80px_rgba(0,0,0,0.95)] transition-all">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-white/5 bg-white/5 p-1.5 text-gray-500 hover:text-white hover:border-white/10 hover:bg-white/10 transition-all duration-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-8">
          <h2 className="text-xl font-bold tracking-tight text-white">Sign in to Raptor AI</h2>
          <p className="mt-1 text-sm text-gray-400">Connect your GitHub account</p>
        </div>

        {/* Action Button */}
        <div className="space-y-6">
          <button
            onClick={handleLogin}
            disabled={loading}
            className={`relative flex w-full items-center justify-center gap-3 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 ${
              loading
                ? 'bg-white/10 border border-white/5 text-gray-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-neutral-200 border border-white shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.25)] active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            ) : (
              <Github className="h-4 w-4 fill-current" />
            )}
            {loading ? 'Connecting to GitHub…' : 'Continue with GitHub'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {/* Terms and Privacy Policy (Passive Agreement) */}
          <div className="space-y-4 pt-2">
            <div className="relative flex justify-center text-center">
              <span className="text-[10px] uppercase tracking-wider text-neutral-600">By continuing</span>
            </div>
            
            <p className="text-xs text-center text-gray-500 leading-relaxed px-2">
              I agree to Raptor AI's{' '}
              <Link to="/terms" onClick={onClose} className="text-white hover:underline font-medium">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" onClick={onClose} className="text-white hover:underline font-medium">Privacy Policy</Link>
              . I understand that Raptor will access my GitHub repositories to perform code reviews.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-white/5 pt-5 text-center">
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Raptor never stores your code. Diffs are analysed in memory and discarded after each review.
          </p>
        </div>
      </div>
    </div>
  )
}
