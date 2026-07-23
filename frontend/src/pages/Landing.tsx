import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, Mail, MapPin, Menu, Phone, X, GitPullRequest, Shield, Zap, Users, ArrowRight } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';

const navItems = [
  { label: 'Documentation', to: '/docs' },
  { label: 'Blog', to: '/blog' },
  { label: 'Pricing', to: '/pricing' },
];

const contactItems = [
  { icon: Mail, label: 'hello@raptor-ai.dev', href: 'mailto:hello@raptor-ai.dev' },
  { icon: Phone, label: '+27 10 500 2472', href: 'tel:+27105002472' },
  { icon: MapPin, label: 'Cape Town, South Africa', href: null },
];

const stats = [
  { value: '18s', label: 'Avg. review time' },
  { value: '94%', label: 'Issues auto-fixed' },
  { value: '3x', label: 'More bugs caught vs manual review' },
  { value: '0', label: 'False positives after 30 days' },
];

const features = [
  { icon: Shield, title: 'Security scanning', desc: 'Catches SQL injections, XSS, secrets exposure, and broken auth before they reach production — not after.' },
  { icon: Zap, title: 'Sub-30s reviews', desc: 'Reviews land as inline GitHub comments the moment a PR opens. No waiting, no context switching.' },
  { icon: GitPullRequest, title: 'Auto-fix PRs', desc: 'Every issue ships with a ready-to-merge fix PR. One click and it\'s resolved.' },
  { icon: Users, title: 'Team memory', desc: 'Learns your conventions after 10 PRs. Suppresses noise, surfaces signal.' },
];

const testimonials = [
  { quote: 'Raptor caught a SQL injection in our auth service that had been in production for 6 months. The fix PR was ready before I finished reading the alert.', name: 'Engineering Lead', company: 'FinTech startup, Cape Town' },
  { quote: 'We went from 45-minute PR reviews to 3 minutes. The team now ships twice as fast and we have fewer bugs in production.', name: 'CTO', company: 'SaaS company, Johannesburg' },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

type TAProps<T extends keyof JSX.IntrinsicElements> = {
  as?: T; animationNum: number; className?: string; children?: React.ReactNode;
} & JSX.IntrinsicElements[T];

function TA<T extends keyof JSX.IntrinsicElements = 'div'>({ as, animationNum, className = '', children, ...props }: TAProps<T>) {
  const C = (as || 'div') as React.ElementType;
  return (
    <C className={`landing-reveal ${className}`} style={{ animationDelay: `${animationNum * 100}ms` }} {...props}>
      {children}
    </C>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5 text-white">
      <TRexIcon className="h-7 w-7" />
      <span className="text-base font-bold tracking-tight">Raptor AI</span>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl select-none" aria-hidden="true">
      <div className="absolute -inset-8 rounded-3xl bg-white/5 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#0a0a10] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex items-center gap-2 rounded border border-white/8 bg-white/5 px-3 py-1 text-xs text-gray-500 font-mono">
            <GitPullRequest className="h-3 w-3 text-white/40" />
            github.com/acme/api · PR #142 · Reviewed in 18s
          </div>
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">LIVE</span>
        </div>

        <div className="grid grid-cols-3 min-h-[340px]">
          {/* Sidebar */}
          <div className="border-r border-white/8 bg-[#080810] p-4 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mb-3">Open PRs</p>
            {[
              { repo: 'api-gateway', pr: '#142', dot: 'bg-red-400', label: '2 critical', active: true },
              { repo: 'auth-service', pr: '#139', dot: 'bg-amber-400', label: '5 high', active: false },
              { repo: 'billing-api', pr: '#131', dot: 'bg-green-400', label: 'Clean', active: false },
            ].map((r) => (
              <div key={r.repo} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${r.active ? 'bg-white/8 text-white' : 'text-gray-600'}`}>
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${r.dot}`} />
                <span className="truncate font-mono flex-1">{r.repo}</span>
                <span className="text-[9px] opacity-60">{r.label}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-white/5 mt-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mb-2">This week</p>
              <div className="space-y-1.5">
                {[['PRs reviewed', '47'], ['Issues found', '183'], ['Auto-fixed', '171'], ['Time saved', '14h']].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{k}</span>
                    <span className="text-white font-mono font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main panel */}
          <div className="col-span-2 p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400 font-mono border border-red-500/20">● Critical</span>
              <span className="text-xs text-white font-semibold">SQL injection via unsanitised user input</span>
            </div>
            <div className="rounded-lg border border-white/8 bg-[#060608] p-3 font-mono text-[11px] leading-relaxed">
              <div className="text-gray-600 mb-1.5">// api/routes/auth.ts · line 47</div>
              <div className="text-red-400/90">- const q = `SELECT * FROM users WHERE email='${'{email}'}'`</div>
              <div className="text-green-400 mt-1">+ const q = 'SELECT * FROM users WHERE email = $1'</div>
              <div className="text-green-400">+ db.query(q, [email])</div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              String interpolation lets an attacker escape the query and read arbitrary tables. Parameterised queries fix this. Raptor has opened a fix PR.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-1.5 rounded border border-white bg-white px-2.5 py-1.5 text-[10px] font-bold text-black cursor-pointer">
                <GitPullRequest className="h-3 w-3" /> Merge Fix PR #143
              </div>
              <div className="flex items-center gap-1.5 rounded border border-white/10 px-2.5 py-1.5 text-[10px] text-gray-500 cursor-pointer hover:text-white">
                Dismiss
              </div>
              <span className="ml-auto text-[10px] text-gray-700 font-mono">Reviewed in 18s · 0 false positives this week</span>
            </div>
            <div className="pt-3 border-t border-white/5 grid grid-cols-4 gap-2">
              {[
                { label: 'Critical', count: 2, max: 10, color: 'bg-red-500' },
                { label: 'High', count: 5, max: 10, color: 'bg-amber-500' },
                { label: 'Medium', count: 8, max: 10, color: 'bg-yellow-500' },
                { label: 'Low', count: 3, max: 10, color: 'bg-blue-500' },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-gray-600">
                    <span>{s.label}</span><span className="text-white">{s.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.count / s.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StickyLoginCTA({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}>
      <button onClick={onLogin} disabled={loading}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-black/95 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-xl transition hover:bg-white hover:text-black disabled:opacity-60">
        <Github className="h-4 w-4" />
        {loading ? 'Connecting…' : 'Start free'}
      </button>
    </div>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();

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
    <section className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.06),transparent_60%)]" />

      {/* ── Nav ── */}
      {isMobile ? (
        <div className="relative z-10 flex items-center justify-between px-5 pt-4">
          <LogoMark />
          <div className="flex items-center gap-2">
            <button onClick={handleGithubLogin} disabled={isLoggingIn}
              className="flex items-center gap-1.5 rounded border border-white bg-white px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-gray-100 disabled:opacity-60">
              <Github className="h-3.5 w-3.5" /> {isLoggingIn ? '…' : 'Login'}
            </button>
            <button className="rounded border border-white/10 p-2 text-gray-400 hover:text-white transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col p-6 pt-16">
              <button className="absolute top-4 right-4 rounded border border-white/10 p-2 text-gray-400" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </button>
              <nav className="space-y-2 mt-4">
                {navItems.map(item => (
                  <Link key={item.label} to={item.to} onClick={() => setMobileMenuOpen(false)}
                    className="block rounded border border-white/10 px-4 py-3 text-sm font-semibold text-gray-300 hover:border-white/30 hover:text-white transition">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      ) : (
        <header className="relative z-10 mx-auto mt-5 flex w-[calc(100%-4rem)] max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/80 px-7 py-4 backdrop-blur-xl">
          <TA animationNum={1} className="flex items-center gap-10">
            <LogoMark />
            <nav className="flex items-center gap-6 text-sm text-gray-400">
              {navItems.map((item) => (
                <Link key={item.label} to={item.to} className="hover:text-white transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
          </TA>
          <TA animationNum={2} className="flex items-center gap-3">
            <button onClick={handleGithubLogin} disabled={isLoggingIn}
              className="flex items-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-semibold text-gray-300 hover:border-white/40 hover:text-white transition disabled:opacity-60">
              Sign in
            </button>
            <button onClick={handleGithubLogin} disabled={isLoggingIn}
              className="flex items-center gap-2 rounded border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition disabled:opacity-60">
              <Github className="h-4 w-4" />
              {isLoggingIn ? 'Connecting…' : 'Start free'}
            </button>
          </TA>
        </header>
      )}

      {/* ── Hero ── */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-24 pb-12 text-center">
        <TA animationNum={1}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-mono text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Now reviewing PRs across 200+ repositories
          </div>
        </TA>
        <TA as="h1" animationNum={2} className="max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl">
          Your team ships bugs.<br />
          <span className="text-gray-400">Raptor catches them</span><br />
          before they merge.
        </TA>
        <TA as="p" animationNum={3} className="mt-6 max-w-lg text-lg text-gray-400 leading-relaxed">
          AI code review that runs the moment a PR opens — catching security flaws, performance regressions, and convention violations in under 30 seconds, with a fix PR ready to merge.
        </TA>
        <TA animationNum={4} className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <button onClick={handleGithubLogin} disabled={isLoggingIn}
            className="flex items-center gap-2 rounded border border-white bg-white px-6 py-3 text-sm font-bold text-black hover:bg-gray-100 transition disabled:opacity-60">
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Review your first PR free'}
          </button>
          <Link to="/docs" className="flex items-center gap-2 rounded border border-white/10 px-6 py-3 text-sm font-semibold text-gray-300 hover:border-white/30 hover:text-white transition">
            See how it works <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </TA>
        <TA animationNum={5} className="mt-4 text-xs text-gray-600">
          Free for open source · No credit card · Connects in 60 seconds
        </TA>
      </div>

      {/* ── Stats ── */}
      <TA animationNum={6} className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-16">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center">
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="mt-1 text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </TA>

      {/* ── Product Mockup ── */}
      <div className="relative z-10 px-6 pb-20">
        <TA animationNum={7}>
          <ProductMockup />
        </TA>
      </div>

      {/* ── Problem → Solution ── */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-20">
        <TA animationNum={8} className="mb-4 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">The problem</p>
          <h2 className="text-3xl font-bold text-white">Manual code review is broken at scale.</h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            The average engineering team spends 6 hours per week per developer on code review. 42% of security vulnerabilities are introduced at the PR stage and missed by human reviewers under deadline pressure. By the time a bug reaches production, it costs 10x more to fix.
          </p>
        </TA>
        <TA animationNum={9} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/8 bg-[#0a0a10] p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="font-bold text-white text-sm">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </TA>
      </div>

      {/* ── How it works ── */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20">
        <TA animationNum={10} className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">How it works</p>
          <h2 className="text-3xl font-bold text-white">From PR to reviewed in 3 steps.</h2>
        </TA>
        <TA animationNum={11} className="grid gap-6 sm:grid-cols-3">
          {[
            { step: '01', icon: Github, title: 'Connect GitHub', desc: 'Install Raptor on any repo in 60 seconds. No config files, no YAML, no infrastructure.' },
            { step: '02', icon: Zap, title: 'PR opens → review starts', desc: 'The moment a PR is opened, Raptor analyses the diff for security, performance, and convention issues.' },
            { step: '03', icon: GitPullRequest, title: 'Fix PR ready to merge', desc: 'Every issue comes with an inline comment and a ready-to-merge fix PR. One click resolves it.' },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="relative rounded-2xl border border-white/8 bg-[#0a0a10] p-6 space-y-3">
              <span className="text-4xl font-black text-white/8 font-mono absolute top-4 right-5">{step}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="font-bold text-white text-sm">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </TA>
      </div>

      {/* ── Social proof ── */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20">
        <TA animationNum={12} className="text-center mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600">What teams say</p>
        </TA>
        <TA animationNum={13} className="grid gap-4 sm:grid-cols-2">
          {testimonials.map(({ quote, name, company }) => (
            <div key={name} className="rounded-2xl border border-white/8 bg-[#0a0a10] p-6 space-y-4">
              <p className="text-sm text-gray-300 leading-relaxed">"{quote}"</p>
              <div>
                <p className="text-xs font-bold text-white">{name}</p>
                <p className="text-xs text-gray-600">{company}</p>
              </div>
            </div>
          ))}
        </TA>
      </div>

      {/* ── Pricing teaser ── */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20">
        <TA animationNum={14} className="rounded-2xl border border-white/10 bg-[#0a0a10] p-8 text-center space-y-6">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Pricing</p>
          <h2 className="text-2xl font-bold text-white">Simple, usage-based pricing.</h2>
          <div className="grid gap-4 sm:grid-cols-3 text-left">
            {[
              { name: 'Starter', price: 'Free', features: ['5 repos', '100 PRs/month', 'Security scanning', 'Community support'] },
              { name: 'Team', price: '$29/mo', features: ['Unlimited repos', 'Unlimited PRs', 'Auto-fix PRs', 'Team memory', 'Priority support'], highlight: true },
              { name: 'Enterprise', price: 'Custom', features: ['SSO / SAML', 'Custom rules', 'Audit logs', 'SLA', 'Dedicated support'] },
            ].map(({ name, price, features, highlight }) => (
              <div key={name} className={`rounded-xl border p-5 space-y-4 ${highlight ? 'border-white bg-white/5' : 'border-white/10'}`}>
                <div>
                  <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{name}</p>
                  <p className="text-2xl font-bold text-white mt-1">{price}</p>
                </div>
                <ul className="space-y-1.5">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="h-1 w-1 rounded-full bg-white/40 flex-none" />{f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleGithubLogin}
                  className={`w-full rounded border py-2 text-xs font-bold transition ${highlight ? 'border-white bg-white text-black hover:bg-gray-100' : 'border-white/10 text-gray-300 hover:border-white/30 hover:text-white'}`}>
                  {name === 'Enterprise' ? 'Contact us' : 'Get started'}
                </button>
              </div>
            ))}
          </div>
        </TA>
      </div>

      {/* ── Final CTA ── */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20">
        <TA animationNum={15} className="rounded-2xl border border-white/10 bg-[#0a0a10] p-12 text-center space-y-6">
          <TRexIcon className="h-12 w-12 mx-auto text-white/20" />
          <h2 className="text-3xl font-bold text-white">Stop shipping bugs to production.</h2>
          <p className="text-gray-400 max-w-md mx-auto">Connect Raptor to your first repo in 60 seconds. Free forever for open source.</p>
          <button onClick={handleGithubLogin} disabled={isLoggingIn}
            className="inline-flex items-center gap-2 rounded border border-white bg-white px-8 py-3 font-bold text-black hover:bg-gray-100 transition disabled:opacity-60">
            <Github className="h-5 w-5" />
            {isLoggingIn ? 'Connecting…' : 'Start reviewing PRs free'}
          </button>
          <p className="text-xs text-gray-600">No credit card · Free for open source · Cancel anytime</p>
        </TA>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10 w-full border-t border-white/8 bg-black">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-1">Contact</p>
              <p className="text-sm font-bold text-white">Built in Cape Town, South Africa.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {contactItems.map(({ icon: Icon, label, href }) => (
                href ? (
                  <a key={label} href={href} className="inline-flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs text-gray-500 hover:border-white/30 hover:text-white transition">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </a>
                ) : (
                  <span key={label} className="inline-flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs text-gray-600">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                )
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6">
            <LogoMark />
            <div className="flex gap-6 text-xs text-gray-600">
              <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
              <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-xs text-gray-700">© 2026 Raptor AI · Cape Town, SA</p>
          </div>
        </div>
      </div>

      <StickyLoginCTA onLogin={handleGithubLogin} loading={isLoggingIn} />
    </section>
  );
}
