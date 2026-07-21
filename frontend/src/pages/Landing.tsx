import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Menu, ShieldAlert, X, Zap } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';

const navItems = [
  { label: 'Products', to: '/docs' },
  { label: 'Leaderboards', to: '/reviews' },
  { label: 'Enterprise', to: '/docs' },
  { label: 'Government', to: '/privacy' },
  { label: 'Customers', to: '/blog' },
];

const customerLogos = ['GitHub', 'Vercel', 'Linear', 'Stripe'];

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

type TimelineAnimationProps<T extends keyof JSX.IntrinsicElements> = {
  as?: T;
  animationNum: number;
  className?: string;
  children?: React.ReactNode;
} & JSX.IntrinsicElements[T];

function TimelineAnimation<T extends keyof JSX.IntrinsicElements = 'div'>({
  as,
  animationNum,
  className = '',
  children,
  ...props
}: TimelineAnimationProps<T>) {
  const Component = (as || 'div') as React.ElementType;

  return (
    <Component
      className={`landing-reveal ${className}`}
      style={{ animationDelay: `${animationNum * 120}ms` }}
      {...props}
    >
      {children}
    </Component>
  );
}

interface MotionDrawerProps {
  children: React.ReactNode;
  width?: number;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

function MotionDrawer({ children, width = 300, isOpen, onToggle }: MotionDrawerProps) {
  return (
    <>
      <button
        className="relative z-20 rounded-sm bg-white p-2 text-black transition hover:bg-neutral-200"
        onClick={() => onToggle(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 h-full w-full bg-black/50"
            onClick={() => onToggle(false)}
            aria-label="Close menu overlay"
          />
          <aside
            className="landing-drawer absolute left-0 top-0 h-full border-r border-neutral-900 bg-black px-8 py-16 text-white shadow-2xl"
            style={{ width }}
          >
            <button
              className="absolute right-6 top-4 rounded bg-neutral-800 p-2 text-white"
              onClick={() => onToggle(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {children}
          </aside>
        </div>
      )}
    </>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-3 text-white">
      <TRexIcon className="h-9 w-9" />
      <span className="text-lg font-semibold tracking-tight">Raptor AI</span>
    </div>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const timelineRef = useRef<HTMLElement>(null);
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
    } catch (error) {
      console.error('Failed to start GitHub login', error);
      setIsLoggingIn(false);
      navigate('/auth/error');
    }
  };

  return (
    <section
      ref={timelineRef}
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black text-white"
    >
      <div className="landing-shader" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(31,70,154,0.25),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.05),#000_92%)]" />

      {isMobile ? (
        <div className="relative z-10 flex items-center justify-between gap-4 px-6 pt-4 sm:px-10">
          <MotionDrawer isOpen={mobileMenuOpen} onToggle={setMobileMenuOpen}>
            <nav className="space-y-4">
              <LogoMark />
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="block rounded-sm p-2 text-neutral-200 hover:bg-neutral-100 hover:text-black"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </MotionDrawer>
          <button
            onClick={handleGithubLogin}
            disabled={isLoggingIn}
            className="cursor-pointer rounded border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20 disabled:opacity-60"
          >
            {isLoggingIn ? 'Connecting…' : 'Register For Free'}
          </button>
        </div>
      ) : (
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-6">
          <TimelineAnimation animationNum={1} className="flex items-center gap-8">
            <LogoMark />
            <nav className="hidden items-center gap-6 text-md text-neutral-300 md:flex">
              {navItems.map((item) => (
                <Link key={item.label} to={item.to} className="transition hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>
          </TimelineAnimation>
          <TimelineAnimation
            as="button"
            animationNum={2}
            onClick={handleGithubLogin}
            disabled={isLoggingIn}
            className="cursor-pointer rounded border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20 disabled:opacity-60"
          >
            {isLoggingIn ? 'Connecting…' : 'Register For Free'}
          </TimelineAnimation>
        </header>
      )}

      <div className="relative z-10 mb-10 flex grow flex-col items-center justify-center px-4 pt-24 text-center">
        <TimelineAnimation animationNum={3} className="flex items-center gap-2 rounded-2xl border border-blue-800 bg-blue-800/50 p-1 pr-3 text-sm backdrop-blur-lg">
          <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-white">New</span>
          <span>Trusted by fast-moving engineering teams</span>
        </TimelineAnimation>
        <TimelineAnimation as="h1" animationNum={4} className="my-5 max-w-5xl text-5xl font-medium leading-[120%] tracking-tight md:text-7xl">
          Powering the Next <br /> Generation of AI <br /> Code Review
        </TimelineAnimation>
        <TimelineAnimation as="p" animationNum={5} className="mb-10 max-w-xl text-lg font-light text-neutral-300 md:text-xl">
          High-signal AI reviews that catch security risks, performance regressions, and team-standard violations before they merge.
        </TimelineAnimation>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <TimelineAnimation as="button" animationNum={6} onClick={handleGithubLogin} disabled={isLoggingIn} className="flex cursor-pointer items-center gap-2 rounded-sm bg-white px-6 py-3 font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60">
            Book a Free Demo <ArrowRight size={18} />
          </TimelineAnimation>
          <TimelineAnimation animationNum={7}>
            <Link to="/docs" className="relative block cursor-pointer rounded-sm border border-white/20 bg-white/10 px-8 py-3 font-semibold backdrop-blur-md transition hover:bg-white/20">
              Build With AI
            </Link>
          </TimelineAnimation>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 py-16">
        <TimelineAnimation as="p" animationNum={7} className="mb-8 text-center text-neutral-400 md:text-xl">
          Raptor works with <span className="font-medium text-white">AI-native teams</span>, security-conscious enterprises, and fast-growing startups
        </TimelineAnimation>
        <div className="flex flex-wrap items-center justify-center gap-6 opacity-75 md:gap-12">
          {customerLogos.map((logo, index) => (
            <TimelineAnimation key={logo} animationNum={8 + index} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xl font-semibold tracking-tight text-white/80">
              {logo}
            </TimelineAnimation>
          ))}
        </div>
        <TimelineAnimation animationNum={12} className="mt-14 grid max-w-4xl gap-4 text-left md:grid-cols-3">
          {[
            'Inline GitHub PR reviews',
            'Security and performance checks',
            'Team convention memory',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
              <Check className="h-5 w-5 text-blue-300" />
              <span>{item}</span>
            </div>
          ))}
        </TimelineAnimation>
      </div>

      <div className="absolute bottom-6 left-6 z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-neutral-300 backdrop-blur md:flex">
        <ShieldAlert className="h-4 w-4 text-blue-300" /> SOC2-minded architecture
        <Zap className="ml-2 h-4 w-4 text-blue-300" /> 30-second GitHub setup
      </div>
    </section>
  );
}
