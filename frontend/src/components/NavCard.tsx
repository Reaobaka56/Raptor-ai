import { useEffect, useRef } from 'react'
import { X, Shield, Zap, GitPullRequest, Users, Check, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface NavCardProps {
  type: 'docs' | 'pricing' | 'features'
  onClose: () => void
  onLogin: () => void
}

function DocsCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { title: 'Getting Started', desc: 'Connect your first repo in 60 seconds', href: '/docs#setup' },
          { title: 'Security Scanning', desc: 'How Raptor detects vulnerabilities', href: '/docs#security' },
          { title: 'Performance Analysis', desc: 'N+1 queries, memory leaks and more', href: '/docs#performance' },
          { title: 'Team Memory', desc: 'Learning your conventions over time', href: '/docs#memory' },
          { title: 'GitHub App Setup', desc: 'Permissions, webhooks, and config', href: '/docs#github' },
          { title: 'API Reference', desc: 'Webhooks, REST endpoints, tokens', href: '/docs#api' },
        ].map(({ title, desc, href }) => (
          <Link key={title} to={href} onClick={onClose}
            className="rounded-xl border border-white/8 bg-white/3 p-4 hover:border-white/20 hover:bg-white/6 transition-all group">
            <p className="text-sm font-semibold text-white group-hover:text-white transition-colors">{title}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>
      <Link to="/docs" onClick={onClose}
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-gray-400 hover:text-white hover:border-white/30 transition-all">
        View full documentation <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function PricingCard({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        {
          name: 'Starter', price: 'Free', sub: 'forever',
          features: ['5 repositories', '100 PRs/month', 'Security scanning', 'Community support'],
          cta: 'Get started', highlight: false,
        },
        {
          name: 'Team', price: '$29', sub: '/month',
          features: ['Unlimited repos', 'Unlimited PRs', 'Auto-fix PRs', 'Team memory', 'Priority support'],
          cta: 'Start free trial', highlight: true,
        },
        {
          name: 'Enterprise', price: 'Custom', sub: 'contact us',
          features: ['SSO / SAML', 'Custom rules', 'Audit logs', 'SLA guarantee', 'Dedicated support'],
          cta: 'Contact us', highlight: false,
        },
      ].map(({ name, price, sub, features, cta, highlight }) => (
        <div key={name} className={`rounded-xl border p-5 space-y-4 ${highlight ? 'border-white bg-white/6' : 'border-white/10'}`}>
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{name}</p>
            <div className="flex items-end gap-1 mt-1.5">
              <span className="text-2xl font-bold text-white">{price}</span>
              <span className="text-xs text-gray-600 mb-0.5">{sub}</span>
            </div>
          </div>
          <ul className="space-y-1.5">
            {features.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                <Check className="h-3 w-3 text-white/40 flex-none" />{f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => { if (name !== 'Enterprise') { onClose(); onLogin(); } }}
            className={`w-full rounded-lg py-2 text-xs font-bold transition ${
              highlight
                ? 'bg-white text-black hover:bg-gray-100'
                : 'border border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
            }`}>
            {cta}
          </button>
        </div>
      ))}
    </div>
  )
}

function FeaturesCard() {
  return (
    <div className="grid grid-cols-1 gap-2">
      {[
        { icon: Shield, title: 'Security Scanning', desc: 'SQL injections, XSS, broken auth, secrets in code — caught before they merge.' },
        { icon: Zap, title: 'Sub-30s Reviews', desc: 'Reviews land as GitHub inline comments the moment a PR is opened. No waiting.' },
        { icon: GitPullRequest, title: 'Auto-Fix PRs', desc: 'Every issue ships with a ready-to-merge fix PR. One click to resolve.' },
        { icon: Users, title: 'Team Memory', desc: 'Learns your conventions after 10 PRs. Suppresses noise, surfaces signal.' },
      ].map(({ icon: Icon, title, desc }) => (
        <div key={title} className="flex items-start gap-4 rounded-lg p-3 hover:bg-white/4 transition-colors">
          <div className="mt-0.5 rounded-lg border border-white/10 bg-white/5 p-2 flex-none">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const CARD_TITLES: Record<string, string> = {
  docs: 'Documentation',
  pricing: 'Pricing',
  features: 'Features',
}

export default function NavCard({ type, onClose, onLogin }: NavCardProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const maxWidth = type === 'pricing' ? 'max-w-2xl' : type === 'docs' ? 'max-w-xl' : 'max-w-lg'

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop fixed inset-0 z-[90] flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className={`modal-card w-full ${maxWidth} rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <p className="text-sm font-bold text-white">{CARD_TITLES[type]}</p>
          <button onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-gray-500 hover:text-white hover:border-white/30 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          {type === 'docs' && <DocsCard onClose={onClose} />}
          {type === 'pricing' && <PricingCard onLogin={onLogin} onClose={onClose} />}
          {type === 'features' && <FeaturesCard />}
        </div>
      </div>
    </div>
  )
}
