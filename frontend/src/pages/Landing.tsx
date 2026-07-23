import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, Mail, MapPin, Menu, Phone, X, GitPullRequest, Shield, Zap, Users } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';

const navItems = [
  { label: 'Documentation', to: '/docs' },
  { label: 'Blog', to: '/blog' },
  { label: 'Privacy', to: '/privacy' },
];

// SA companies as text badges (no trademark issues, same as before but styled better)
// SA companies displayed as SVG wordmarks in the landing page
;

const contactItems = [
  { icon: Mail, label: 'hello@raptor-ai.dev', href: 'mailto:hello@raptor-ai.dev' },
  { icon: Phone, label: '+27 10 500 2472', href: 'tel:+27105002472' },
  { icon: MapPin, label: 'Cape Town, South Africa', href: null },
];

const features = [
  { icon: Shield, title: 'Security First', desc: 'Catches SQL injections, XSS, and auth flaws before they reach production.' },
  { icon: Zap, title: 'Instant Reviews', desc: 'Sub-30-second PR reviews with inline GitHub comments and fix suggestions.' },
  { icon: GitPullRequest, title: 'Auto-Fix PRs', desc: 'Generates a ready-to-merge fix pull request alongside each review.' },
  { icon: Users, title: 'Team Memory', desc: 'Learns your conventions and suppresses false positives over time.' },
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

function TA<T extends keyof JSX.IntrinsicElements = 'div'>({
  as, animationNum, className = '', children, ...props
}: TAProps<T>) {
  const C = (as || 'div') as React.ElementType;
  return (
    <C className={`landing-reveal ${className}`} style={{ animationDelay: `${animationNum * 120}ms` }} {...props}>
      {children}
    </C>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-3 text-white">
      <TRexIcon className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight">Raptor AI</span>
    </div>
  );
}

/** macOS-style product mockup */
function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl select-none" aria-hidden="true">
      {/* Glow behind window */}
      <div className="absolute -inset-6 rounded-3xl bg-indigo-500/10 blur-3xl" />

      {/* macOS window chrome */}
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0d0d14] shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#111118] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-500 font-mono">
            <GitPullRequest className="h-3 w-3 text-indigo-400" />
            github.com/your-org/api · PR #42
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-3 min-h-[320px]">
          {/* Sidebar */}
          <div className="border-r border-white/8 bg-[#0a0a10] p-4 space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-3">Reviews</p>
            {[
              { repo: 'api-gateway', pr: '#42', dot: 'bg-red-400', active: true },
              { repo: 'auth-service', pr: '#39', dot: 'bg-amber-400', active: false },
              { repo: 'billing-api', pr: '#31', dot: 'bg-green-400', active: false },
            ].map((r) => (
              <div key={r.repo}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${r.active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${r.dot}`} />
                <span className="truncate font-mono">{r.repo}</span>
                <span className="ml-auto text-gray-600">{r.pr}</span>
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="col-span-2 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400 font-mono">Critical</span>
              <span className="text-xs text-white font-semibold">SQL Injection via unsanitised user input</span>
            </div>
            <div className="rounded-lg border border-white/8 bg-[#0a0a10] p-3 font-mono text-[11px] leading-relaxed">
              <div className="text-gray-600 mb-1">// auth/login.ts · line 47</div>
              <div className="text-red-400">- const query = `SELECT * FROM users WHERE email = '${'{email}'}'`</div>
              <div className="text-green-400 mt-1">+ const query = 'SELECT * FROM users WHERE email = $1'</div>
              <div className="text-green-400">+ db.query(query, [email])</div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Direct string interpolation allows an attacker to escape the query and read arbitrary tables. Use parameterised queries to prevent injection.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-300 cursor-pointer hover:bg-indigo-500/20 transition-colors">
                <GitPullRequest className="h-3 w-3" /> Open Fix PR
              </div>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] text-gray-600 font-mono">Reviewed in 18s</span>
            </div>

            {/* Severity bar */}
            <div className="pt-3 border-t border-white/8 grid grid-cols-4 gap-2">
              {[
                { label: 'Critical', count: 2, color: 'bg-red-500' },
                { label: 'High', count: 5, color: 'bg-amber-500' },
                { label: 'Medium', count: 8, color: 'bg-yellow-500' },
                { label: 'Low', count: 3, color: 'bg-blue-500' },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-gray-600">
                    <span>{s.label}</span><span className="text-white">{s.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.count / 18) * 100}%` }} />
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

/** Sticky GitHub login CTA that appears after scrolling 300px */
function StickyLoginCTA({ onLogin, loading }: { onLogin: () => void; loading: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
      }`}
    >
      <button
        onClick={onLogin}
        disabled={loading}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-black/90 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl transition hover:bg-white hover:text-black disabled:opacity-60"
      >
        <Github className="h-4 w-4" />
        {loading ? 'Connecting…' : 'Login with GitHub'}
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
      const res = await fetch(`${apiBaseUrl}/api/auth/github/login?redirectUri=${encodeURIComponent(redirectUri)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch login url');
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setIsLoggingIn(false);
      navigate('/auth/error');
    }
  };

  const MobileMenu = () => (
    <>
      <button
        className="relative z-20 rounded-sm border border-white bg-black p-2 text-white transition hover:bg-white hover:text-black"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 h-full w-full bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="landing-drawer absolute left-0 top-0 h-full w-72 border-r border-white bg-black px-8 py-16 text-white shadow-2xl">
            <TRexIcon className="pointer-events-none absolute -right-16 top-24 h-48 w-48 text-white/10" />
            <button className="absolute right-6 top-4 rounded border border-white bg-black p-2 text-white transition hover:bg-white hover:text-black" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <LogoMark />
            <nav className="mt-8 space-y-3">
              {navItems.map((item) => (
                <Link key={item.label} to={item.to}
                  className="block rounded-sm p-2 text-neutral-200 hover:bg-neutral-100 hover:text-black transition"
                  onClick={() => setMobileMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );

  return (
    <section className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-black text-white">
      <div className="landing-shader" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.10),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),#000_92%)]" />

      {/* ── Nav ── */}
      {isMobile ? (
        <div className="relative z-10 flex items-center justify-between gap-4 px-6 pt-4">
          <MobileMenu />
          <button onClick={handleGithubLogin} disabled={isLoggingIn}
            className="inline-flex items-center gap-2 rounded border border-white bg-black px-3 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:opacity-60">
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Login'}
          </button>
        </div>
      ) : (
        <header className="relative z-10 mx-auto mt-4 flex w-[calc(100%-4rem)] max-w-7xl items-center justify-between overflow-hidden rounded-2xl border border-white bg-black/85 px-8 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur">
          <TRexIcon className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-white/10" />
          <TA animationNum={1} className="flex items-center gap-8">
            <LogoMark />
            <nav className="hidden items-center gap-6 text-sm text-neutral-200 md:flex">
              {navItems.map((item) => (
                <Link key={item.label} to={item.to} className="transition hover:text-white underline-offset-4 hover:underline">
                  {item.label}
                </Link>
              ))}
            </nav>
          </TA>
          <TA as="button" animationNum={2} onClick={handleGithubLogin} disabled={isLoggingIn}
            className="inline-flex cursor-pointer items-center gap-2 rounded border border-white bg-black px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black disabled:opacity-60">
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Login with GitHub'}
          </TA>
        </header>
      )}

      {/* ── Hero ── */}
      <div className="relative z-10 flex grow flex-col items-center justify-center px-4 pt-20 pb-8 text-center">
        <TA as="h1" animationNum={3} className="my-5 max-w-5xl text-5xl font-medium leading-[120%] tracking-tight md:text-7xl">
          Powering the Next <br /> Generation of AI <br /> Code Review
        </TA>
        <TA as="p" animationNum={4} className="mb-10 max-w-xl text-lg font-light text-neutral-200 md:text-xl">
          High-signal AI reviews that catch security risks, performance regressions, and team-standard violations before they merge.
        </TA>
        <TA animationNum={5} className="flex flex-col items-center gap-4 sm:flex-row">
          <button onClick={handleGithubLogin} disabled={isLoggingIn}
            className="flex cursor-pointer items-center gap-2 rounded-sm border border-white bg-white px-6 py-3 font-semibold text-black transition hover:bg-black hover:text-white disabled:opacity-60">
            <Github className="h-5 w-5" />
            {isLoggingIn ? 'Connecting…' : 'Start Free with GitHub'}
          </button>
          <Link to="/docs" className="block cursor-pointer rounded-sm border border-white bg-black px-8 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black">
            Read Docs
          </Link>
        </TA>
      </div>

      {/* ── Product Mockup ── */}
      <div className="relative z-10 px-6 py-12">
        <TA animationNum={6}>
          <ProductMockup />
        </TA>
      </div>

      {/* ── Feature cards ── */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12">
        <TA animationNum={7} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-black p-5 space-y-3 hover:border-white/20 transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </TA>
      </div>

      {/* ── Contact / Footer ── */}
      <div className="relative z-10 w-full bg-black border-t border-white/10 mt-8">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-gray-600">Contact</p>
              <p className="mt-2 text-lg font-bold text-white">Build with Raptor AI from South Africa.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {contactItems.map(({ icon: Icon, label, href }) => (
                href ? (
                  <a key={label} href={href}
                    className="inline-flex items-center gap-2 rounded border border-white/10 px-4 py-2 text-sm text-gray-400 hover:border-white/30 hover:text-white transition-colors">
                    <Icon className="h-4 w-4" /> {label}
                  </a>
                ) : (
                  <span key={label}
                    className="inline-flex items-center gap-2 rounded border border-white/10 px-4 py-2 text-sm text-gray-400">
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                )
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6">
            <div className="flex items-center gap-2.5">
              <TRexIcon className="h-5 w-5 text-white" />
              <span className="text-sm font-bold text-white">Raptor AI</span>
            </div>
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

      {/* ── Sticky CTA ── */}
      <StickyLoginCTA onLogin={handleGithubLogin} loading={isLoggingIn} />
    </section>
  );
}
