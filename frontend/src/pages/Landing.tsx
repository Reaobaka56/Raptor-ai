import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, Mail, MapPin, Menu, Phone, X, GitPullRequest, Shield, Zap, Users, ChevronDown } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';
import SignInModal from '../components/SignInModal';
import NavCard from '../components/NavCard';

const navItems = [
  { label: 'Features', key: 'features' },
  { label: 'Docs', key: 'docs' },
  { label: 'Pricing', key: 'pricing' },
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
    <div className="border-t border-white/8 py-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold text-white hover:text-gray-300 transition-colors"
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 text-gray-500 flex-none ml-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <p className="pb-5 text-sm text-gray-400 leading-relaxed">{a}</p>}
    </div>
  );
}


  return (
    <div className="border-t border-white/8 py-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold text-white hover:text-gray-300 transition-colors"
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 text-gray-500 flex-none ml-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl select-none">
      <div className="absolute -inset-12 bg-white/3 blur-3xl rounded-full" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#08080f] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex items-center gap-2 rounded border border-white/8 bg-white/4 px-3 py-1 text-[11px] text-gray-500 font-mono">
            <GitPullRequest className="h-3 w-3 text-white/30" />
            github.com/acme/api · PR #142
          </div>
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/20">18s</span>
        </div>
        <div className="grid grid-cols-3 min-h-[340px]">
          <div className="border-r border-white/8 bg-[#06060c] p-4 space-y-1">
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
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/8 py-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold text-white hover:text-gray-300 transition-colors"
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 text-gray-500 flex-none ml-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <p className="pb-5 text-sm text-gray-400 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [activeCard, setActiveCard] = useState<'docs' | 'pricing' | 'features' | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
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

      {/* Sign-in modal */}
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
              <button key={item.key} onClick={() => setActiveCard(item.key as 'docs' | 'pricing' | 'features')}
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
        <button className="md:hidden rounded border border-white/10 p-2 text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col px-6 pt-20 pb-8">
            <button className="absolute top-4 right-4 rounded border border-white/10 p-2 text-gray-400" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <nav className="space-y-1 flex-1">
              {navItems.map(item => (
                'key' in item ? (
                  <button key={item.key}
                    onClick={() => { setMobileMenuOpen(false); setActiveCard(item.key as 'docs' | 'pricing' | 'features'); }}
                    className="block w-full text-left py-3 text-lg font-semibold text-gray-300 border-b border-white/8 hover:text-white transition">
                    {item.label}
                  </button>
                ) : (
                  <Link key={item.label} to={item.to!} onClick={() => setMobileMenuOpen(false)}
                    className="block py-3 text-lg font-semibold text-gray-300 border-b border-white/8 hover:text-white transition">
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
        <ProductMockup />
      </section>

      {/* ── How it works ── */}
      <section className="px-4 md:px-12 pb-32 max-w-5xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">How Raptor works</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-16">From PR open to reviewed in seconds.</h2>
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { n: '01', icon: Github, title: 'Connect GitHub in 60 seconds', desc: 'Install Raptor on any repo. No config files, no YAML, no infra. It works the moment it\'s installed.' },
            { n: '02', icon: Zap, title: 'PR opens → review starts', desc: 'The moment a PR is opened, Raptor analyses the diff for security vulnerabilities, performance regressions, and convention violations.' },
            { n: '03', icon: GitPullRequest, title: 'Fix PR ready to merge', desc: 'Every issue comes with an inline GitHub comment explaining the problem and a fix PR that\'s ready to merge in one click.' },
          ].map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-600">{n}</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <Icon className="h-6 w-6 text-white" />
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-4 md:px-12 pb-32 max-w-5xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">What Raptor catches</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-16">Every category of issue. Automatically.</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Shield, title: 'Security vulnerabilities', desc: 'SQL injections, XSS, secrets in code, broken authentication, missing rate limits — caught before they reach production.' },
            { icon: Zap, title: 'Performance regressions', desc: 'N+1 queries, missing indexes, unoptimised loops, memory leaks — identified with specific line numbers and fixes.' },
            { icon: Users, title: 'Team convention violations', desc: 'Raptor learns your team\'s specific patterns after 10 PRs and enforces them automatically on every new PR.' },
            { icon: GitPullRequest, title: 'Code quality issues', desc: 'Dead code, overly complex functions, missing error handling, inconsistent naming — flagged with one-click fixes.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-3 hover:border-white/15 transition-colors">
              <Icon className="h-5 w-5 text-white" />
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-4 md:px-12 pb-32 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t border-b border-white/8 py-16">
          {[
            { value: '18s', label: 'Average review time' },
            { value: '94%', label: 'Issues auto-fixed' },
            { value: '3×', label: 'More bugs caught vs manual' },
            { value: '<1%', label: 'False positive rate' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-white">{value}</p>
              <p className="mt-2 text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="px-4 md:px-12 pb-32 max-w-4xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">What teams say</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-12">Teams ship faster and safer.</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { quote: 'Raptor caught a SQL injection in our auth service that had been in production for 6 months. The fix PR was ready before I finished reading the alert.', name: 'Engineering Lead', company: 'FinTech startup, Cape Town' },
            { quote: 'We went from 45-minute PR reviews to 3 minutes. The team now ships twice as fast and we have fewer bugs in production.', name: 'CTO', company: 'SaaS company, Johannesburg' },
          ].map(({ quote, name, company }) => (
            <div key={name} className="rounded-2xl border border-white/8 bg-white/2 p-8 space-y-6">
              <p className="text-sm text-gray-300 leading-relaxed">"{quote}"</p>
              <div>
                <p className="text-xs font-bold text-white">{name}</p>
                <p className="text-xs text-gray-600 mt-0.5">{company}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-4 md:px-12 pb-32 max-w-4xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">Pricing</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-12">Simple, honest pricing.</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: 'Starter', price: 'Free', sub: 'forever', features: ['5 repos', '100 PRs/month', 'Security scanning', 'Community support'], cta: 'Get started', highlight: false },
            { name: 'Team', price: '$29', sub: 'per month', features: ['Unlimited repos', 'Unlimited PRs', 'Auto-fix PRs', 'Team memory', 'Priority support'], cta: 'Start free trial', highlight: true },
            { name: 'Enterprise', price: 'Custom', sub: 'contact us', features: ['SSO / SAML', 'Custom rules', 'Audit logs', 'SLA', 'Dedicated support'], cta: 'Contact us', highlight: false },
          ].map(({ name, price, sub, features, cta, highlight }) => (
            <div key={name} className={`rounded-2xl border p-6 space-y-6 ${highlight ? 'border-white bg-white/5' : 'border-white/10'}`}>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-mono">{name}</p>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-3xl font-bold text-white">{price}</span>
                  <span className="text-xs text-gray-600 mb-1">{sub}</span>
                </div>
              </div>
              <ul className="space-y-2">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="h-1 w-1 rounded-full bg-white/30 flex-none" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={name !== 'Enterprise' ? handleGithubLogin : undefined}
                className={`w-full rounded-full py-2.5 text-sm font-bold transition ${highlight ? 'bg-white text-black hover:bg-gray-100' : 'border border-white/15 text-gray-300 hover:border-white/30 hover:text-white'}`}>
                {cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 md:px-12 pb-32 max-w-2xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-4">FAQ</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-12">Frequently asked questions.</h2>
        <div className="border-t border-white/8">
          {faqs.map(faq => <FAQItem key={faq.q} {...faq} />)}
        </div>
      </section>

      {/* ── Final CTA ── */}
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

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 px-6 md:px-12 py-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
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
            {[['Docs', '/docs'], ['Blog', '/blog'], ['Pricing', '/pricing'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Changelog', '/changelog']].map(([label, to], i) => (
              <Link key={label} to={to} className={`text-xs text-gray-600 hover:text-white transition ${i >= 3 ? '' : ''}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-12 pt-8 border-t border-white/5 text-xs text-gray-700">
          © 2026 Raptor AI. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
