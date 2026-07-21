import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Github, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';

const navItems = [
  { label: 'Official Documentation', to: '/docs' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Blog', to: '/blog' },
];

const customerLogos = ['Naspers', 'Discovery', 'Takealot', 'Capitec'];

const contactItems = [
  { icon: Mail, label: 'hello@raptor-ai.dev' },
  { icon: Phone, label: '+27 10 500 2472' },
  { icon: MapPin, label: 'Cape Town, South Africa' },
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
        className="relative z-20 rounded-sm border border-white bg-black p-2 text-white transition hover:bg-white hover:text-black"
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
            className="landing-drawer absolute left-0 top-0 h-full overflow-hidden border-r border-white bg-black px-8 py-16 text-white shadow-2xl"
            style={{ width }}
          >
            <TRexIcon className="pointer-events-none absolute -right-16 top-24 h-48 w-48 text-white/10" />
            <button
              className="absolute right-6 top-4 rounded border border-white bg-black p-2 text-white transition hover:bg-white hover:text-black"
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


function WindowsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3 5.2 10.8 4v7.4H3V5.2Zm8.8-1.35L21 2.5v8.9h-9.2V3.85ZM3 12.6h7.8V20L3 18.8v-6.2Zm8.8 0H21v8.9l-9.2-1.35V12.6Z" />
    </svg>
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.10),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),#000_92%)]" />

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
            className="inline-flex cursor-pointer items-center gap-2 rounded border border-white bg-black px-3 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white hover:text-black disabled:opacity-60"
          >
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Login with GitHub'}
          </button>
        </div>
      ) : (
        <header className="relative z-10 mx-auto mt-4 flex w-[calc(100%-4rem)] max-w-7xl items-center justify-between overflow-hidden rounded-2xl border border-white bg-black/85 px-8 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur">
          <TRexIcon className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-white/10" />
          <TimelineAnimation animationNum={1} className="flex items-center gap-8">
            <LogoMark />
            <nav className="hidden items-center gap-6 text-md text-neutral-200 md:flex">
              {navItems.map((item) => (
                <Link key={item.label} to={item.to} className="transition hover:text-white underline-offset-4 hover:underline">
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
            className="inline-flex cursor-pointer items-center gap-2 rounded border border-white bg-black px-3 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white hover:text-black disabled:opacity-60"
          >
            <Github className="h-4 w-4" />
            {isLoggingIn ? 'Connecting…' : 'Login with GitHub'}
          </TimelineAnimation>
        </header>
      )}

      <div className="relative z-10 mb-10 flex grow flex-col items-center justify-center px-4 pt-24 text-center">
        <TimelineAnimation as="h1" animationNum={4} className="my-5 max-w-5xl text-5xl font-medium leading-[120%] tracking-tight md:text-7xl">
          Powering the Next <br /> Generation of AI <br /> Code Review
        </TimelineAnimation>
        <TimelineAnimation as="p" animationNum={5} className="mb-10 max-w-xl text-lg font-light text-neutral-200 md:text-xl">
          High-signal AI reviews that catch security risks, performance regressions, and team-standard violations before they merge.
        </TimelineAnimation>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <TimelineAnimation as="button" animationNum={6} onClick={handleGithubLogin} disabled={isLoggingIn} className="flex cursor-pointer items-center gap-2 rounded-sm border border-white bg-white px-6 py-3 font-semibold text-black transition hover:bg-black hover:text-white disabled:opacity-60">
            Get for Desktop <WindowsIcon />
          </TimelineAnimation>
          <TimelineAnimation animationNum={7}>
            <Link to="/docs" className="relative block cursor-pointer rounded-sm border border-white bg-black px-8 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black">
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
            <TimelineAnimation key={logo} animationNum={8 + index} className="rounded-xl border border-white bg-black px-5 py-3 text-xl font-semibold tracking-tight text-white/80">
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
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white bg-black p-4 backdrop-blur-md">
              <Check className="h-5 w-5 text-white" />
              <span>{item}</span>
            </div>
          ))}
        </TimelineAnimation>
      </div>

      <nav className="relative z-10 mx-auto mb-8 mt-2 w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-3xl border border-white bg-black px-6 py-6 text-sm text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)] md:px-8">
        <TRexIcon className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 text-white/10" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold uppercase tracking-[0.3em] text-white/60">Contact</p>
            <p className="mt-2 text-lg font-semibold">Build with Raptor AI from South Africa.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {contactItems.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white px-3 py-2">
                <Icon className="h-4 w-4" /> {label}
              </span>
            ))}
          </div>
        </div>
      </nav>
    </section>
  );
}
