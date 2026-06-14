import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  Twitter, 
  Linkedin, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Check,
  Menu,
  X,
  Zap,
  Layers,
  Cpu,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';

/* ─── Skeleton loader ─── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-black animate-pulse">
      {/* Nav skeleton */}
      <div className="fixed top-0 w-full z-50 h-16 bg-black/60 border-b border-white/10 flex items-center px-6 gap-4">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="w-20 h-4" />
        <div className="ml-auto flex gap-4">
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-24 h-8 rounded-xl" />
        </div>
      </div>
      {/* Hero skeleton */}
      <div className="pt-40 pb-20 flex flex-col items-center gap-6 px-6">
        <Skeleton className="w-64 h-5 rounded-full" />
        <Skeleton className="w-full max-w-2xl h-12 rounded-xl" />
        <Skeleton className="w-full max-w-xl h-8 rounded-xl" />
        <Skeleton className="w-full max-w-lg h-5 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="w-40 h-11 rounded-xl" />
          <Skeleton className="w-40 h-11 rounded-xl" />
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
        {[0,1,2].map(i => (
          <div key={i} className="rounded-2xl border border-white/5 p-6 space-y-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <Skeleton className="w-3/4 h-5 rounded" />
            <Skeleton className="w-full h-3 rounded" />
            <Skeleton className="w-5/6 h-3 rounded" />
            <Skeleton className="w-4/5 h-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section Modal ─── */
type SectionId = 'problem' | 'features' | 'faq' | 'docs' | null;

interface SectionModalProps {
  sectionId: SectionId;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
  title: string;
}

function SectionModal({ sectionId, onClose, children, title }: SectionModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!sectionId) return null;

  return (
    <div className="section-modal-overlay" onClick={onClose}>
      <div className="section-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 sm:px-8 py-5 border-b border-white/[0.07]" style={{ background: 'linear-gradient(145deg,#1c1c26,#121219)', borderRadius: '28px 28px 0 0' }}>
          <h2 className="text-lg font-bold text-white tracking-tight font-mono uppercase">{title}</h2>
          <button
            onClick={onClose}
            className="clay-btn-ghost !p-2 !rounded-xl text-gray-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 sm:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<SectionId>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

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

  const openSection = (id: SectionId) => {
    setActiveModal(id);
    setMobileMenuOpen(false);
  };

  const faqs = [
    {
      question: "How is Raptor different from standard static analysis tools?",
      answer: "Traditional linters and static tools rely on strict regex patterns, resulting in overwhelming false positives. Raptor utilizes advanced AI language models trained on vulnerability databases and AST trees to understand the semantic intent of your code. It catches logical auth bypasses and complex N+1 queries that static linters miss."
    },
    { 
      question: "How do I install Raptor on my team's repositories?", 
      answer: "Installation takes exactly 30 seconds. You install the Raptor GitHub App onto your GitHub organization or personal account and select which repositories to grant access to. Zero IDE plugins or CLI configurations required." 
    },
    { 
      question: "Does Raptor store our proprietary source code?", 
      answer: "No. Raptor processes code diffs entirely in memory during the webhook lifecycle. Once the review comment is posted to GitHub, the diff payload is wiped completely. We maintain strict SOC2 compliance." 
    },
    { 
      question: "What languages and frameworks are supported?", 
      answer: "Raptor provides deep AST parsing and review support for TypeScript/JavaScript (Next.js, React, Node, Express), Python (Django, FastAPI), Go, Java (Spring Boot), Rust, and C++." 
    },
    { 
      question: "What is the pricing model?", 
      answer: "Raptor is completely free for public open-source repositories and individual developers up to 50 PRs per month. For enterprise teams, we offer unlimited seats and predictable per-repo pricing." 
    },
  ];

  const testimonials = [
    {
      name: "Elaine",
      handle: "@elaine9573",
      avatarUrl: "https://api.dicebear.com/7.x/pixel-art/svg?seed=elaine9573&backgroundColor=ffb300",
      text: "This is exactly what we need in the AI dev space right now. Been watching too many devs struggle with clunky workflows when they could be shipping faster with tools like this. The terminal-to-agent pipeline is going to be huge for productivity."
    },
    {
      name: "Alan",
      handle: "@alon",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=alon&backgroundColor=1e88e5",
      text: "This chain of automated inline replies reminds me of the famous HN comment about Dropbox. Catching auth bypasses before staging is a game changer for our team."
    },
    {
      name: "Jama",
      handle: "@jama211",
      avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=jama211&backgroundColor=8e24aa",
      text: "Yeah exactly, this is awesome, I've always wondered while waiting for AI operations to complete why I'm 'tied' to my machine and can't just shut my laptop while it worked and see what it'd done later. This is so cool."
    },
    {
      name: "Keshav",
      handle: "@keshav628",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=keshav628&backgroundColor=00acc1",
      text: "Having an autonomous agent comment directly on my PRs is simply quicker than manual review. You can explore more directions and iterate without breaking your flow. This is f*ing cool product."
    }
  ];

  const sectionTitles: Record<string, string> = {
    problem: 'The Problem',
    features: "Raptor's Features",
    faq: 'FAQ',
    docs: 'Documentation',
  };

  if (loading) return <LandingSkeleton />;

  return (
    <div className="min-h-screen text-gray-300 font-sans selection:bg-white/20 selection:text-white overflow-x-hidden" style={{ background: 'var(--clay-bg)' }}>

      {/* ─── Section Modal Overlay ─── */}
      {activeModal && (
        <SectionModal
          sectionId={activeModal}
          onClose={() => setActiveModal(null)}
          isDark={true}
          title={sectionTitles[activeModal] || activeModal}
        >
          {activeModal === 'problem' && (
            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> The Problem
                </div>
                <h3 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                  Code reviews are slow, shallow, and miss logical flaws.
                </h3>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                  Teams spend hours checking for syntax, styling, and basic bugs. Meanwhile, critical security vulnerabilities, database performance leaks (N+1s), and violations of unique team conventions slip into production unnoticed.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: 'Regex-bound Linters', body: 'Traditional linters miss logic-based auth bypasses and generate heavy noise, leading to notification fatigue.' },
                  { title: 'Overloaded Devs', body: 'Human reviewers lack time to check every line thoroughly, leaving architectural landmines in codebase margins.' },
                  { title: 'No Standards Context', body: "Standard general AI review tools don't understand your team's specific legacy codebase patterns or conventions." },
                  { title: 'Manual Fixes Only', body: 'Discovering bugs requires manual rewrite, PR re-submission, and secondary validation passes.' },
                ].map(c => (
                  <div key={c.title} className="clay-card p-5 space-y-2">
                    <h4 className="text-white font-semibold font-mono text-xs uppercase">{c.title}</h4>
                    <p className="text-xs text-gray-500">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModal === 'features' && (
            <div className="space-y-10">
              <div className="text-center space-y-3">
                <h3 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Raptor's Feature Engine</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">Everything your engineering team needs to review, secure, and auto-fix code natively in GitHub.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { icon: Cpu, title: 'AST-level Code Scans', body: 'Parses the Abstract Syntax Tree of code diffs to verify structural security, performance logic, and catch N+1 query patterns instantly.' },
                  { icon: Layers, title: 'Semantic Team Memory', body: 'Saves past pull request feedback and accepted/rejected patterns in pgvector. Learns and adapts automatically to enforce custom guidelines.' },
                  { icon: Zap, title: 'Auto Fix PR Generation', body: "Generate fully automated PR branches with correct code fixes. Review details, select issues, and click 'Create Fix PR' to apply them immediately." },
                ].map(f => (
                  <div key={f.title} className="clay-card p-6 space-y-4">
                    <div className="p-3 w-fit rounded-xl" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))', boxShadow: 'var(--clay-shadow-sm)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <f.icon className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-white font-mono">{f.title}</h4>
                    <p className="text-sm text-gray-400">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModal === 'faq' && (
            <div className="space-y-3 max-w-2xl mx-auto">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border rounded-xl overflow-hidden transition-colors border-white/10 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-md">
                  <button
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none text-white"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  >
                    <span className="font-medium text-sm tracking-wide">{faq.question}</span>
                    {openFaq === idx ? (
                      <Minus className="w-4 h-4 shrink-0 ml-4 text-gray-400" />
                    ) : (
                      <Plus className="w-4 h-4 shrink-0 ml-4 text-gray-400" />
                    )}
                  </button>
                  {openFaq === idx && (
                    <div className="px-6 pb-6 text-sm leading-relaxed border-white/5 text-gray-400 border-t pt-4">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeModal === 'docs' && (
            <div className="space-y-6">
              <p className="text-gray-400 text-sm leading-relaxed">
                Full documentation is available at our dedicated docs portal. Below are quick start links.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { title: 'Quick Start', desc: 'Get Raptor running on your repos in 30 seconds.' },
                  { title: 'GitHub App Setup', desc: 'Install and configure the Raptor GitHub App.' },
                  { title: 'Rule Manager', desc: 'Create custom conventions for your codebase.' },
                  { title: 'API Reference', desc: 'Integrate Raptor programmatically.' },
                ].map(d => (
                  <Link key={d.title} to="/docs" className="clay-card p-5 space-y-1 block">
                    <h4 className="text-white font-semibold font-mono text-sm">{d.title}</h4>
                    <p className="text-xs text-gray-500">{d.desc}</p>
                  </Link>
                ))}
              </div>
              <Link to="/docs" className="clay-btn inline-flex items-center gap-2 mt-2">
                View Full Docs <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </SectionModal>
      )}

      {/* ─── Navbar ─── */}
      <nav className="clay-nav fixed top-0 w-full z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="animate-clay-bounce">
              <TRexIcon className="w-7 h-7" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.4)) drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }} />
            </div>
            <span className="text-white font-black text-lg tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>Raptor</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            {(['problem','features','faq','docs'] as SectionId[]).map(id => (
              <button
                key={id}
                onClick={() => openSection(id)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider font-mono text-gray-400 hover:text-white transition-all hover:bg-white/[0.06]"
                style={{ letterSpacing: '0.08em' }}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="clay-btn"
            >
              {isLoggingIn ? 'Connecting…' : 'Get Started'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden clay-btn-ghost !p-2 !rounded-xl"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full border-t border-white/[0.07] px-6 py-6 space-y-2 font-mono text-sm animate-fadeIn" style={{ background: 'rgba(12,12,20,0.97)', backdropFilter: 'blur(28px)' }}>
            {(['problem','features','faq','docs'] as SectionId[]).map(id => (
              <button key={id} onClick={() => openSection(id)} className="block py-2.5 w-full text-left text-gray-400 hover:text-white font-bold uppercase tracking-wider text-xs">{id}</button>
            ))}
            <div className="pt-4 border-t border-white/[0.07]">
              <button
                onClick={() => { setMobileMenuOpen(false); handleGithubLogin(); }}
                disabled={isLoggingIn}
                className="clay-btn w-full justify-center"
              >
                {isLoggingIn ? 'Connecting…' : 'Get Started'}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="section-hero relative pt-32 pb-20">
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] text-white/5 blur-[70px] -z-10 pointer-events-none select-none flex items-center justify-center animate-float">
          <TRexIcon className="w-full h-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-6">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Real-time PR diff analysis.<br />
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              Autonomous code review.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Raptor AI is an autonomous code review and static analysis platform. It combines AST-level analysis with a team-specific semantic memory layer to catch high-impact issues and generate reliable, inline fixes automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="clay-btn w-full sm:w-auto"
            >
              {isLoggingIn ? 'Connecting…' : 'Connect GitHub'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#demo"
              className="clay-btn-ghost w-full sm:w-auto"
            >
              <Terminal className="w-4 h-4" />
              View Live Demo
            </a>
          </div>
        </div>
      </section>

      {/* ─── Demo Section ─── */}
      <section id="demo" className="section-demo max-w-5xl mx-auto px-6 mb-24 scroll-mt-24">
        <div className="relative rounded-2xl border border-slate-800 bg-[#0a0a0a] backdrop-blur-2xl shadow-2xl overflow-hidden font-mono text-left">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-black">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <span className="text-[10px] sm:text-xs text-gray-400 ml-2 sm:ml-4 truncate max-w-[200px] sm:max-w-none">
                github.com/organization/api-gateway/pull/88
              </span>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-300 border border-white/10 font-mono">
                <Check className="w-3 h-3 text-white" /> status: ready
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-8 space-y-6 bg-black">
            <div className="flex items-start gap-3 sm:gap-4 font-sans">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <TRexIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 font-mono">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-white text-sm sm:text-base">Raptor</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-white/10 text-gray-300 border border-white/20">bot</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">left a review comment 1m ago</span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-2 bg-white/5 px-2.5 py-1 rounded inline-block border border-white/10">
                  Target: <span className="text-white font-semibold">src/controllers/paymentController.ts</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 font-mono font-bold text-white text-xs sm:text-sm">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>CRITICAL: Severe SQL Injection Detected</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-mono">
                Direct string concatenation detected in raw database query parameter. Unsanitized input from <code className="bg-white/10 px-1 py-0.5 rounded text-white">req.body.customerId</code> permits arbitrary query execution.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden font-mono text-[10px] sm:text-xs">
              <div className="bg-white/[0.04] px-4 py-2 border-b border-white/10 flex items-center justify-between text-[10px] text-gray-400">
                <span>Diff Changes</span>
                <span className="text-gray-500">Lines 42-45</span>
              </div>
              <div className="bg-black divide-y divide-white/5 overflow-x-auto">
                <div className="flex items-center px-4 py-2.5 text-gray-500 bg-white/[0.01]">
                  <span className="w-6 select-none text-gray-600 shrink-0">-</span>
                  <span className="whitespace-pre">const invoice = await db.raw(`SELECT * FROM invoices WHERE id = '${`req.body.customerId`}'`);</span>
                </div>
                <div className="flex items-center px-4 py-2.5 text-white bg-white/[0.05] border-l-2 border-white">
                  <span className="w-6 select-none text-white shrink-0">+</span>
                  <span className="whitespace-pre font-bold">const invoice = await db.query('SELECT * FROM invoices WHERE id = $1', [req.body.customerId]);</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button className="clay-btn text-[10px] sm:text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Apply Fix Directly
              </button>
              <button className="clay-btn-ghost text-[10px] sm:text-xs">
                Explain Issue
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problem Section ─── */}
      <section id="problem" className="section-problem max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" /> The Problem
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Code reviews are slow, shallow, and miss logical flaws.
            </h2>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
              Teams spend hours checking for syntax, styling, and basic bugs. Meanwhile, critical security vulnerabilities, database performance leaks (N+1s), and violations of unique team conventions slip into production unnoticed.
            </p>
            <button
              onClick={() => openSection('problem')}
              className="clay-btn-ghost"
            >
              Learn more <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Regex-bound Linters', body: 'Traditional linters miss logic-based auth bypasses and generate heavy noise, leading to notification fatigue.' },
              { title: 'Overloaded Devs', body: 'Human reviewers lack time to check every line thoroughly, leaving architectural landmines in codebase margins.' },
              { title: 'No Standards Context', body: "Standard general AI review tools don't understand your team's specific legacy codebase patterns or conventions." },
              { title: 'Manual Fixes Only', body: 'Discovering bugs requires manual rewrite, PR re-submission, and secondary validation passes.' },
            ].map(c => (
              <div key={c.title} className="clay-card p-6 space-y-2 text-left">
                <h4 className="text-white font-semibold font-mono text-sm uppercase">{c.title}</h4>
                <p className="text-xs text-gray-500">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Solution Section ─── */}
      <section id="solution" className="section-solution max-w-6xl mx-auto px-6 py-16 border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> The Solution
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            An Autonomous Review Brain
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Raptor sits directly inside your GitHub workflows. By combining AST-level deep logic parsing with a vector memory layer that learns your conventions over time, it catches both universal flaws and team-specific code requirements.
          </p>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section id="features" className="section-features max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">Raptor's Feature Engine</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Everything your engineering team needs to review, secure, and auto-fix code natively in GitHub.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Cpu, title: 'AST-level Code Scans', body: 'Parses the Abstract Syntax Tree of code diffs to verify structural security, performance logic, and catch N+1 query patterns instantly.' },
            { icon: Layers, title: 'Semantic Team Memory', body: 'Saves past pull request feedback and accepted/rejected patterns in pgvector. Learns and adapts automatically to enforce custom guidelines.' },
            { icon: Zap, title: 'Auto Fix PR Generation', body: "Generate fully automated PR branches with correct code fixes. Review details, select issues, and click 'Create Fix PR' to apply them immediately." },
          ].map(f => (
            <div key={f.title} className="clay-card p-6 space-y-4 text-left">
              <div className="p-3 w-fit" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))', boxShadow: 'var(--clay-shadow-sm)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white font-mono">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.body}</p>
              <button
                onClick={() => openSection('features')}
                className="clay-btn-ghost !text-[10px]"
              >
                <Sparkles className="w-3 h-3" /> Explore
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials Section ─── */}
      <section id="community" className="section-community max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="max-w-2xl mb-12 text-left">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-4 font-mono text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            From the community
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold mb-6 tracking-tight text-white">
            It fits into your life.
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-gray-400">
            Reviewing code while walking the dog, or checking live pull request scan telemetry from your phone. Raptor moves wherever you are.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((item, idx) => (
            <div 
              key={idx} 
              className="clay-card p-8 text-left"
            >
              <div className="flex items-center gap-3.5 mb-5">
                <img 
                  src={item.avatarUrl} 
                  alt={item.name} 
                  className="w-10 h-10 rounded-full border shrink-0 object-cover"
                  style={{ boxShadow: 'var(--clay-shadow-sm)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                />
                <div>
                  <div className="font-bold text-sm tracking-wide text-white">{item.name}</div>
                  <div className="text-xs font-mono text-gray-500">{item.handle}</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing Section ─── */}
      <section id="pricing" className="section-pricing max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Plans for every team size</h2>
          <p className="text-sm max-w-md mx-auto text-gray-400">
            Get started for free or scale your secure reviews with our team plans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tier 1 */}
          <div className="clay-card p-8 flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div className="text-xs font-bold font-mono uppercase text-gray-500">Hobbyist</div>
              <div className="text-3xl font-black font-mono text-white">$0 <span className="text-xs font-sans text-gray-500">/ month</span></div>
              <p className="text-xs text-gray-400">Great for individual developers scanning public source repositories.</p>
              <ul className="space-y-2 text-xs pt-4 text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> 50 scans per month</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Public repositories</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Basic AST parsing</li>
              </ul>
            </div>
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="clay-btn-ghost mt-8 w-full justify-center"
            >
              {isLoggingIn ? 'Connecting…' : 'Get Started'}
            </button>
          </div>

          {/* Tier 2 — Popular — clay-indigo accent */}
          <div className="relative p-8 flex flex-col justify-between text-left" style={{ borderRadius: '20px', background: 'linear-gradient(145deg,#1e1e34,#14142a)', boxShadow: 'var(--clay-shadow-indigo)', border: '1.5px solid rgba(99,102,241,0.35)' }}>
            <div className="absolute top-0 right-6 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full font-mono text-indigo-200" style={{ background: 'linear-gradient(145deg,#6366f1,#4f46e5)', boxShadow: 'var(--clay-shadow-indigo)', border: '1px solid rgba(165,180,252,0.3)' }}>✦ Popular</div>
            <div className="space-y-4">
              <div className="text-xs font-bold font-mono uppercase text-indigo-400">Professional</div>
              <div className="text-3xl font-black font-mono text-white">$49 <span className="text-xs font-sans text-gray-400">/ month</span></div>
              <p className="text-xs text-gray-400">Perfect for scaling startup teams requiring memory layers and private repos.</p>
              <ul className="space-y-2 text-xs pt-4 text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-indigo-400" /> Unlimited scans</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-indigo-400" /> Private repositories</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-indigo-400" /> pgvector Team Memory</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-indigo-400" /> Convention Rule management</li>
              </ul>
            </div>
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="clay-btn-indigo mt-8 w-full justify-center"
            >
              {isLoggingIn ? 'Connecting…' : 'Start Pro Trial'}
            </button>
          </div>

          {/* Tier 3 */}
          <div className="clay-card p-8 flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div className="text-xs font-bold font-mono uppercase text-gray-500">Enterprise</div>
              <div className="text-3xl font-black font-mono text-white">Custom</div>
              <p className="text-xs text-gray-400">High-security compliance configurations for multi-org development teams.</p>
              <ul className="space-y-2 text-xs pt-4 text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Custom model hosting (self-hosted)</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Org-wide architectural learning</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Dedicated support</li>
              </ul>
            </div>
            <a
              href="mailto:contact@raptor.dev"
              className="clay-btn-ghost mt-8 w-full justify-center text-center inline-flex items-center"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* ─── FAQ Section ─── */}
      <section id="faq" className="section-faq max-w-4xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Frequently asked questions</h2>
          <p className="text-sm text-gray-500 mt-3">Click any question or <button onClick={() => openSection('faq')} className="text-indigo-400 hover:underline">open in full view</button></p>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto text-left">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="clay-card overflow-hidden"
              style={{ padding: 0 }}
            >
              <button 
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none text-white transition-colors hover:bg-white/[0.02] rounded-[20px]"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className="font-semibold text-sm md:text-base tracking-wide">{faq.question}</span>
                <span className="ml-4 shrink-0 w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))', boxShadow: 'var(--clay-shadow-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {openFaq === idx ? <Minus className="w-3.5 h-3.5 text-gray-400" /> : <Plus className="w-3.5 h-3.5 text-gray-400" />}
                </span>
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-6 text-sm leading-relaxed text-gray-400 border-t border-white/[0.06] pt-4">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="section-cta max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.05] text-center">
        <div className="relative overflow-hidden space-y-6 p-8 sm:p-16" style={{ borderRadius: '28px', background: 'linear-gradient(145deg,#1a1a2e,#0f0f1e)', boxShadow: 'var(--clay-shadow-lg)', border: '1.5px solid rgba(99,102,241,0.2)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 65%)' }} />
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">Ready to ship secure code faster?</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Join engineering teams using Raptor to find vulnerabilities, manage standards, and auto-generate pull request fixes.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="clay-btn"
            >
              {isLoggingIn ? 'Connecting…' : 'Login with GitHub'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
      
      {/* ─── Footer Section ─── */}
      <footer className="section-footer relative border-white/10 border-t pt-16 pb-0 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 mb-20 relative z-10 text-left">
          <div className="space-y-4">
            <div className="flex items-center gap-3 font-bold">
              <TRexIcon className="w-6 h-6" />
              <span className="text-lg tracking-tight font-bold text-white">Raptor</span>
            </div>
            <p className="text-xs leading-relaxed max-w-xs text-gray-500">
              Autonomous Abstract Syntax Tree (AST) code scanning with integrated semantic memory layers.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 font-medium text-sm">
            <span className="text-xs font-bold uppercase font-mono tracking-wider text-white">Navigation</span>
            <Link to="/" className="transition-colors text-gray-400 hover:text-white">Home</Link>
            <Link to="/docs" className="transition-colors text-gray-400 hover:text-white">Docs</Link>
            <Link to="/blog" className="transition-colors text-gray-400 hover:text-white">Blog</Link>
            <Link to="/changelog" className="transition-colors text-gray-400 hover:text-white">Changelog</Link>
          </div>

          <div className="flex flex-col gap-3 font-medium text-sm">
            <span className="text-xs font-bold uppercase font-mono tracking-wider text-white">Legal</span>
            <Link to="/terms" className="transition-colors text-gray-400 hover:text-white">Terms of Service</Link>
            <Link to="/privacy" className="transition-colors text-gray-400 hover:text-white">Privacy Policy</Link>
            <span className="text-xs text-gray-600">All rights reserved</span>
            <div className="flex gap-3 mt-2">
              <a href="#" className="clay-btn-ghost !p-0 w-10 h-10 !rounded-full flex items-center justify-center">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="clay-btn-ghost !p-0 w-10 h-10 !rounded-full flex items-center justify-center">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Enhanced RAPTOR Watermark */}
        <div className="relative w-full overflow-hidden" style={{ height: '22vw', minHeight: '120px', maxHeight: '260px' }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full text-center pointer-events-none select-none">
            <span
              className="font-black tracking-tighter block leading-none font-sans"
              style={{
                fontSize: 'clamp(80px, 22vw, 280px)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 60px rgba(255,255,255,0.08))',
              }}
            >
              RAPTOR
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
