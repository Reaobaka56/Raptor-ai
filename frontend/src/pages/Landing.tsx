import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, Mail, MapPin, Menu, Phone, X, GitPullRequest, Shield, Zap, Users, ChevronDown, KeyRound, Building2, Plug } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';
import SignInModal from '../components/SignInModal';
import NavCard from '../components/NavCard';
import { ProviderLogo, mcpClients, providers } from '../components/ProviderLogos';

/** Fades + slides children in the first time they scroll into view. */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const navItems = [
  { label: 'Features', key: 'features' },
  { label: 'Docs', key: 'docs' },
  { label: 'Blog', to: '/blog' },
];

const contactItems = [
  { icon: Mail, label: 'hello@raptor-ai.dev', href: 'mailto:hello@raptor-ai.dev' },
  { icon: Phone, label: '+27 10 500 2472', href: 'tel:+27105002472' },
  { icon: MapPin, label: 'Cape Town, South Africa', href: null },
];

const faqs = [
  { q: 'How long does it take to set up?', a: 'Under 60 seconds. Connect your GitHub account, install Raptor on a repo, and your first PR review will be waiting the next time a PR is opened.' },
  { q: 'Does it work on private repositories?', a: 'Yes. Raptor works on both public and private repositories. Code is never stored — only the diff is analysed and discarded after review.' },
  { q: 'What languages does Raptor support?', a: 'Raptor supports all major languages including TypeScript, Python, Go, Java, Rust, Ruby, and more. Language detection is automatic.' },
  { q: 'How is this different from GitHub Copilot?', a: 'Copilot helps you write code. Raptor reviews code after it\'s written — catching security issues, performance regressions, and convention violations that Copilot doesn\'t flag.' },
  { q: 'What does "team memory" mean?', a: 'After 10 PRs, Raptor learns your team\'s specific conventions and suppresses rules that don\'t apply to your codebase — reducing false positives to near zero.' },
  { q: 'Is there a free plan?', a: 'Yes. Raptor is free for up to 5 repositories and 100 PRs per month. Open source projects get unlimited reviews for free.' },
];


function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold text-white hover:text-gray-300 transition-colors">
        {q}
        <ChevronDown className={`h-4 w-4 text-gray-500 flex-none ml-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-5 text-sm text-gray-400 leading-relaxed">{a}</p>}
    </div>
  );
}

function ProductMockup() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    const el = badgeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBadgeVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-4xl select-none">
      <div className="absolute -inset-12 bg-white/3 blur-3xl rounded-full" />
      <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#0d0d14] shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-[#08080f] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex items-center gap-2 rounded border border-white/5 bg-white/4 px-3 py-1 text-[11px] text-gray-500 font-mono">
            <GitPullRequest className="h-3 w-3 text-white/30" />
            github.com/acme/api · PR #142
          </div>
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/20">18s</span>
        </div>
        <div className="grid grid-cols-3 min-h-[340px]">
          <div className="border-r border-white/5 bg-[#06060c] p-4 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-gray-700 mb-3">Open PRs</p>
            {[
              { repo: 'api-gateway', pr: '#142', dot: 'bg-red-400', label: '2 critical', active: true },
              { repo: 'auth-service', pr: '#139', dot: 'bg-amber-400', label: '5 high', active: false },
              { repo: 'billing-api', pr: '#131', dot: 'bg-green-400', label: 'Clean', active: false },
            ].map((r) => (
              <div key={r.repo} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${r.active ? 'bg-white/6 text-white' : 'text-gray-700'}`}>
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${r.dot}`} />
                <span className="truncate font-mono flex-1 text-[11px]">{r.repo}</span>
                <span className="text-[9px] opacity-60">{r.label}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-white/5 mt-4 space-y-2">
              {[['PRs reviewed', '47'], ['Issues found', '183'], ['Auto-fixed', '171'], ['Time saved', '14h']].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] text-gray-700">{k}</span>
                  <span className="text-[10px] text-white font-mono font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2 p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-red-500/12 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400 font-mono border border-red-500/15">● Critical</span>
              <span className="text-xs text-white font-semibold">SQL injection via unsanitised user input</span>
            </div>
            <div className="rounded-lg border border-white/6 bg-[#04040a] p-3 font-mono text-[11px] leading-relaxed">
              <div className="text-gray-600 mb-1.5">// api/routes/auth.ts · line 47</div>
              <div className="text-red-400/80">- const q = `SELECT * FROM users WHERE email='${'{email}'}'`</div>
              <div className="text-green-400/90 mt-1">+ const q = 'SELECT * FROM users WHERE email = $1'</div>
              <div className="text-green-400/90">+ db.query(q, [email])</div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              String interpolation lets an attacker escape the query and read arbitrary tables. Parameterised queries fix this. Fix PR is ready to merge.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-1.5 rounded border border-white bg-white px-2.5 py-1.5 text-[10px] font-bold text-black cursor-pointer">
                <GitPullRequest className="h-3 w-3" /> Merge Fix PR
              </div>
              <span className="text-[10px] text-gray-700 font-mono ml-auto">0 false positives this week</span>
            </div>
            <div className="pt-3 border-t border-white/5 grid grid-cols-4 gap-2">
              {[['Critical', 2, 'bg-red-500'], ['High', 5, 'bg-amber-500'], ['Medium', 8, 'bg-yellow-500'], ['Low', 3, 'bg-blue-500']].map(([label, count, color]) => (
                <div key={label as string} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-gray-600">
                    <span>{label}</span><span className="text-white">{count}</span>
                  </div>
                  <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${((count as number) / 10) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fade-in badge, bottom-left corner of the card */}
      <div
        ref={badgeRef}
        className={`mockup-badge ${badgeVisible ? 'is-visible' : ''} absolute -bottom-5 -left-5 z-10 hidden sm:flex items-center gap-2.5 rounded-xl border border-white/6 bg-[#0d0d14]/95 backdrop-blur px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)]`}
      >
        <span className="relative flex h-2 w-2 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
        </span>
        <div>
          <p className="text-xs font-bold text-white leading-tight">Reviewing live</p>
          <p className="text-[10px] text-gray-500 leading-tight">Avg. 18s per PR</p>
        </div>
      </div>
    </div>
  );
}


function PublicStats() {
  const [stats, setStats] = useState<{totalReviews:number;totalIssues:number;avgReviewTime:number}|null>(null)
  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || 'https://raptor-ai.onrender.com/api').replace(/\/api$/, '').replace(/\/$/, '')
    fetch(`${base}/api/stats`).then(r => r.ok ? r.json() : null).then(d => { if(d) setStats(d) }).catch(()=>{})
  }, [])
  const items = [
    { value: stats ? (stats.totalReviews > 0 ? stats.totalReviews.toLocaleString() : '0') : '…', label: 'PRs reviewed' },
    { value: stats ? (stats.totalIssues > 0 ? stats.totalIssues.toLocaleString() : '0') : '…', label: 'Issues caught' },
    { value: stats && stats.avgReviewTime > 0 ? `${Math.round(stats.avgReviewTime/1000)}s` : '—', label: 'Avg review time' },
    { value: '<1%', label: 'False positive rate' },
  ]
  return (
    <section className="px-4 md:px-12 pb-32 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t border-b border-white/5 py-16">
        {items.map(({ value, label }) => (
          <div key={label}>
            <p className="text-4xl font-bold text-white">{value}</p>
            <p className="mt-2 text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [activeCard, setActiveCard] = useState<'docs' | 'features' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Check if redirected due to session expiry
    if (window.location.search.includes('session_expired=1')) {
      setSessionExpired(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGithubLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const apiBaseUrl = (import.meta.env.VITE_API_URL || 'https://raptor-ai.onrender.com').replace(/\/api$/, '');
      const redirectUri = getGithubRedirectUri();
      const res = await fetch(`${apiBaseUrl}/api/auth/github/login?redirectUri=${encodeURIComponent(redirectUri)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setIsLoggingIn(false);
      navigate('/auth/error');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1" aria-hidden="true" />
      <div className="bg-orb bg-orb-2" aria-hidden="true" />
      <div className="bg-orb bg-orb-3" aria-hidden="true" />

      {/* Animated background logo watermark — scattered dino marks */}
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className={`bg-logo-wrap bg-logo-wrap-${n}`} aria-hidden="true">
          <TRexIcon className="bg-logo-mark" />
        </div>
      ))}

      {/* Session expired banner */}
      {sessionExpired && (
        <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between bg-amber-500/90 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-black">
          <span>Your session expired. Please sign in again.</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSignIn(true)}
              className="rounded bg-black/15 px-3 py-1 text-xs hover:bg-black/25 transition">
              Sign in
            </button>
            <button onClick={() => setSessionExpired(false)} className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onLogin={handleGithubLogin}
        />
      )}

      {/* Nav popup cards */}
      {activeCard && (
        <NavCard
          type={activeCard}
          onClose={() => setActiveCard(null)}
          onLogin={() => { setActiveCard(null); setShowSignIn(true); }}
        />
      )}

      {/* ── Nav ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-300 ${scrolled ? 'nav-glass' : 'nav-transparent'}`}>
        <Link to="/" className="flex items-center gap-2 text-white relative z-10">
          <TRexIcon className="h-6 w-6" />
          <span className="text-sm font-bold tracking-tight">Raptor AI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          {navItems.map(item => (
            'key' in item ? (
              <button key={item.key} onClick={() => setActiveCard(item.key as 'docs' | 'features')}
                className="hover:text-white transition-colors">
                {item.label}
              </button>
            ) : (
              <Link key={item.label} to={item.to!} className="hover:text-white transition-colors">{item.label}</Link>
            )
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => setShowSignIn(true)}
            className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign in
          </button>
          <button onClick={() => setShowSignIn(true)}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition">
            <Github className="h-4 w-4" /> Get started
          </button>
        </div>

        {/* Mobile */}
        <button className="md:hidden rounded border border-white/6 p-2 text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col px-6 pt-20 pb-8">
            <button className="absolute top-4 right-4 rounded border border-white/6 p-2 text-gray-400" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <nav className="space-y-1 flex-1">
              {navItems.map(item => (
                'key' in item ? (
                  <button key={item.key}
                    onClick={() => { setMobileMenuOpen(false); setActiveCard(item.key as 'docs' | 'features'); }}
                    className="block w-full text-left py-3 text-lg font-semibold text-gray-300 border-b border-white/5 hover:text-white transition">
                    {item.label}
                  </button>
                ) : (
                  <Link key={item.label} to={item.to!} onClick={() => setMobileMenuOpen(false)}
                    className="block py-3 text-lg font-semibold text-gray-300 border-b border-white/5 hover:text-white transition">
                    {item.label}
                  </Link>
                )
              ))}
            </nav>
            <button onClick={() => { setMobileMenuOpen(false); setShowSignIn(true); }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-black">
              <Github className="h-4 w-4" /> Get started free
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center min-h-screen px-4 pt-20 text-center">
        <h1 className="max-w-3xl text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
          AI code review that actually catches bugs.
        </h1>
        <p className="mt-6 max-w-md text-lg md:text-xl text-gray-400 leading-relaxed">
          Raptor reviews every pull request in under 30 seconds — finding security flaws, performance issues, and bad patterns before they ship.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button onClick={() => setShowSignIn(true)}
            className="flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-black hover:bg-gray-100 transition disabled:opacity-60">
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Review your first PR free'}
          </button>
          <Link to="/docs" className="text-sm text-gray-500 hover:text-white transition-colors underline underline-offset-4">
            See how it works
          </Link>
        </div>
        <p className="mt-5 text-xs text-gray-700">Free for open source · No credit card · Connects in 60 seconds</p>
      </section>

      {/* ── Product mockup ── */}
      <section className="px-4 md:px-12 pb-32">
        <Reveal>
          <ProductMockup />
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 md:px-12 pb-32 max-w-5xl mx-auto">
        <Reveal>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">How Raptor works</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-16">From PR open to reviewed in seconds.</h2>
        </Reveal>
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { n: '01', icon: Github, title: 'Connect GitHub in 60 seconds', desc: 'Install Raptor on any repo. No config files, no YAML, no infra. It works the moment it\'s installed.' },
            { n: '02', icon: Zap, title: 'PR opens → review starts', desc: 'The moment a PR is opened, Raptor analyses the diff for security vulnerabilities, performance regressions, and convention violations.' },
            { n: '03', icon: GitPullRequest, title: 'Fix PR ready to merge', desc: 'Every issue comes with an inline GitHub comment explaining the problem and a fix PR that\'s ready to merge in one click.' },
          ].map(({ n, icon: Icon, title, desc }, i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-600">{n}</span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
                <Icon className="h-6 w-6 text-white" />
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-4 md:px-12 pb-32 max-w-5xl mx-auto">
        <Reveal>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">What Raptor catches</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-16">Every category of issue. Automatically.</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 items-stretch">
          {[
            { icon: Shield, title: 'Security vulnerabilities', desc: 'SQL injections, XSS, secrets in code, broken authentication, missing rate limits — caught before they reach production.' },
            { icon: Zap, title: 'Performance regressions', desc: 'N+1 queries, missing indexes, unoptimised loops, memory leaks — identified with specific line numbers and fixes.' },
            { icon: Users, title: 'Team convention violations', desc: 'Raptor learns your team\'s specific patterns after 10 PRs and enforces them automatically on every new PR.' },
            { icon: GitPullRequest, title: 'Code quality issues', desc: 'Dead code, overly complex functions, missing error handling, inconsistent naming — flagged with one-click fixes.' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 80} className="h-full">
              <div className="h-full flex flex-col rounded-2xl border border-white/5 bg-white/2 p-6 space-y-3 hover:border-white/10 transition-colors">
                <Icon className="h-5 w-5 text-white" />
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Bring any model ── */}
      <section className="px-4 md:px-12 pb-32 max-w-5xl mx-auto">
        <Reveal>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">Model flexibility</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 max-w-2xl">Bring any model — or provision centrally for your whole org.</h2>
          <p className="text-sm md:text-base text-gray-500 leading-relaxed max-w-2xl mb-12">
            Connect your own API key from any major provider, or let admins provision keys centrally so every engineer reviews with the same model — no per-seat setup, no shared secrets in Slack.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-16 items-stretch">
          {providers.map((p) => (
            <ProviderLogo key={p.name} {...p} className="h-full" />
          ))}
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 items-start">
          <Reveal className="space-y-5">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-white flex-none mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Bring your own key (BYOK)</h3>
                <p className="text-sm text-gray-500 leading-relaxed mt-1">Keys are encrypted at rest and never leave your workspace context — swap providers per repo, per team, or per PR.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-white flex-none mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">Centralized org provisioning</h3>
                <p className="text-sm text-gray-500 leading-relaxed mt-1">Admins set the model and billing once; every team inherits it automatically, with usage broken down per repo.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Plug className="h-5 w-5 text-white flex-none mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white">An MCP gateway, usable from any client</h3>
                <p className="text-sm text-gray-500 leading-relaxed mt-1">Point Claude Desktop, Cursor, VS Code, or any MCP-compatible client at Raptor's gateway and pull review context straight into your editor.</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative mx-auto w-full max-w-md select-none">
              <div className="absolute -inset-8 bg-white/3 blur-3xl rounded-full" />
              <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#0d0d14] shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
                <div className="flex items-center gap-2 border-b border-white/5 bg-[#08080f] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <div className="mx-auto flex items-center gap-2 rounded border border-white/5 bg-white/4 px-3 py-1 text-[11px] text-gray-500 font-mono">
                    <Plug className="h-3 w-3 text-white/30" />
                    mcp.raptor-ai.dev
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="rounded-lg border border-white/6 bg-[#04040a] p-3 font-mono text-[11px] leading-relaxed">
                    <div className="text-gray-600 mb-1.5">// mcp.json</div>
                    <div className="text-white/70">{'{'}</div>
                    <div className="text-white/70 pl-3">"mcpServers": {'{'}</div>
                    <div className="text-white/70 pl-6">"raptor": {'{'}</div>
                    <div className="pl-9"><span className="text-blue-300/80">"url"</span>: <span className="text-green-400/90">"https://mcp.raptor-ai.dev"</span></div>
                    <div className="text-white/70 pl-6">{'}'}</div>
                    <div className="text-white/70 pl-3">{'}'}</div>
                    <div className="text-white/70">{'}'}</div>
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-gray-700 pt-1">Works with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mcpClients.map((c) => (
                      <span key={c} className="rounded-full border border-white/5 bg-white/4 px-2.5 py-1 text-[10px] text-gray-400">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Stats — real data from API ── */}
      <PublicStats />

      {/* ── FAQ ── */}
      <section className="px-4 md:px-12 pb-32 max-w-2xl mx-auto">
        <Reveal>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Frequently asked questions.</h2>
          <div className="border-t border-white/5">
            {faqs.map(faq => <FAQItem key={faq.q} {...faq} />)}
          </div>
        </Reveal>
      </section>

      {/* ── Final CTA ── */}
      <Reveal>
        <section className="px-4 md:px-12 pb-32 text-center">
          <h2 className="text-4xl md:text-6xl font-bold max-w-2xl mx-auto leading-tight">
            Code review that helps during the PR, not after.
          </h2>
          <p className="mt-6 text-gray-400 max-w-md mx-auto">Try Raptor on your next pull request today.</p>
          <div className="mt-10">
            <button onClick={() => setShowSignIn(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-black hover:bg-gray-100 transition disabled:opacity-60">
              <Github className="h-4 w-4" />
              {isLoggingIn ? 'Connecting…' : 'Start reviewing PRs free'}
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-700">Free for open source · No credit card · Cancel anytime</p>
        </section>
      </Reveal>

      {/* ── Footer ── */}
      <footer className="relative border-t border-white/5 px-6 md:px-12 py-12 overflow-hidden">
        <div className="footer-watermark" aria-hidden="true"><span>RAPTOR</span></div>
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TRexIcon className="h-5 w-5 text-white" />
              <span className="text-sm font-bold text-white">Raptor AI</span>
            </div>
            <p className="text-xs text-gray-600 max-w-xs">AI code review for engineering teams. Built in Cape Town, South Africa.</p>
            <div className="flex flex-col gap-1.5">
              {contactItems.map(({ icon: Icon, label, href }) => (
                href ? (
                  <a key={label} href={href} className="flex items-center gap-2 text-xs text-gray-600 hover:text-white transition">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </a>
                ) : (
                  <span key={label} className="flex items-center gap-2 text-xs text-gray-700">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                )
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
            <p className="text-xs font-bold text-white mb-2 col-span-1">Product</p>
            <p className="text-xs font-bold text-white mb-2 col-span-1">Company</p>
            {[['Docs', '/docs'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Changelog', '/changelog']].map(([label, to], i) => (
              <Link key={label} to={to} className={`text-xs text-gray-600 hover:text-white transition ${i >= 3 ? '' : ''}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto mt-12 pt-8 border-t border-white/5 text-xs text-gray-700">
          © 2026 Raptor AI. All rights reserved.
        </div>
      </footer>

    </div>
  );
}

