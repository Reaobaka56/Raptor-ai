import { useState } from 'react';
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
  Sparkles,
  Zap,
  Layers,
  Cpu,
  AlertTriangle,
  Moon,
  Sun
} from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import { getGithubRedirectUri } from '../api';
import { useTheme } from '../theme';


export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

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

  return (
    <div className={`min-h-screen ${isDark ? 'bg-black text-gray-300' : 'bg-white text-slate-900'} font-sans ${isDark ? 'selection:bg-white/20 selection:text-white' : 'selection:bg-slate-900/10 selection:text-slate-900'} overflow-x-hidden`}>
      
      {/* Navbar Section */}
      <nav className={`fixed top-0 w-full z-50 ${isDark ? 'bg-black/60 border-white/10' : 'bg-white/60 border-slate-200'} backdrop-blur-xl border-b transition-all`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <TRexIcon className={`w-7 h-7 ${isDark ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]' : 'drop-shadow-[0_0_8px_rgba(0,0,0,0.2)]'}`} />
            <span className={`${isDark ? 'text-white' : 'text-black'} font-bold text-lg tracking-tight`}>Raptor</span>
          </Link>
          
          <div className={`hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide uppercase font-mono ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
            <a href="#problem" className={`${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>Problem</a>
            <a href="#features" className={`${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>Features</a>
            <a href="#pricing" className={`${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>Pricing</a>
            <a href="#faq" className={`${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>FAQ</a>
            <Link to="/docs" className={`${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>Docs</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors border inline-flex items-center gap-1 text-xs font-semibold ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10 border-white/10 bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/10 border-slate-300/40 bg-slate-900/5'}`}
              title="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className={`px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.15)] ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-slate-800'}`}
            >
              {isLoggingIn ? 'Connecting...' : 'Get Started'}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 focus:outline-none ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className={`md:hidden absolute top-16 left-0 w-full ${isDark ? 'bg-black border-white/10' : 'bg-white border-slate-200'} border-b px-6 py-6 space-y-4 font-mono text-sm animate-fadeIn`}>
            <a href="#problem" onClick={() => setMobileMenuOpen(false)} className={`block py-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Problem</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className={`block py-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className={`block py-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className={`block py-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>FAQ</a>
            <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className={`block py-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Docs</Link>
            <div className={`pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-200'} space-y-3`}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  toggleTheme()
                }}
                className={`w-full p-2 rounded-lg transition-colors border inline-flex items-center justify-center gap-2 text-xs font-semibold ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10 border-white/10 bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/10 border-slate-300/40 bg-slate-900/5'}`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleGithubLogin()
                }}
                disabled={isLoggingIn}
                className={`w-full text-center block px-5 py-3 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-slate-800'}`}
              >
                {isLoggingIn ? 'Connecting...' : 'Get Started'}
              </button>
            </div>
          </div>
        )}
      </nav>
                  setMobileMenuOpen(false)
                  handleGithubLogin()
                }}
                disabled={isLoggingIn}
                className="w-full text-center block px-5 py-3 rounded-lg text-xs font-bold bg-white text-black hover:bg-gray-200 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? 'Connecting...' : 'Get Started'}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20">
        <div className="absolute top-[250px] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-gradient-to-tr from-amber-600/10 via-orange-500/5 to-transparent blur-[140px] -z-10 pointer-events-none rounded-full" />
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] text-white/5 blur-[50px] sm:blur-[70px] -z-10 pointer-events-none select-none flex items-center justify-center">
          <TRexIcon className="w-full h-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white font-mono uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Next-gen Team Memory Layer Added
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Real-time PR diff analysis.<br />
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              Autonomous code review.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Raptor AI is an autonomous code review and static analysis platform. It combines AST-level analysis with a team-specific semantic memory layer to catch high-impact issues and generate reliable, inline fixes automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 font-sans">
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-bold text-black bg-white hover:bg-gray-200 transition-all duration-200 shadow-[0_0_25px_rgba(255,255,255,0.15)] text-xs uppercase tracking-wider font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Connecting...' : 'Connect GitHub'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 text-xs uppercase tracking-wider font-mono backdrop-blur-md"
            >
              <Terminal className="w-4 h-4 text-gray-400" />
              View Live Demo
            </a>
          </div>
        </div>
      </section>

      {/* Product Screenshot / PR review interface mockup */}
      <section id="demo" className="max-w-5xl mx-auto px-6 mb-24 scroll-mt-24">
        <div className="relative rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-2xl overflow-hidden font-mono text-left">
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

            <div className="flex items-center gap-3 pt-2 font-mono">
              <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold bg-white text-black hover:bg-gray-200 transition-colors uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" /> Apply Fix Directly
              </button>
              <button className="px-4 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 transition-colors uppercase tracking-wider">
                Explain Issue
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-white/5 bg-white/[0.01] space-y-2 text-left">
              <h4 className="text-white font-semibold font-mono text-sm uppercase">Regex-bound Linters</h4>
              <p className="text-xs text-gray-500">Traditional linters miss logic-based auth bypasses and generate heavy noise, leading to notification fatigue.</p>
            </div>
            <div className="p-6 rounded-xl border border-white/5 bg-white/[0.01] space-y-2 text-left">
              <h4 className="text-white font-semibold font-mono text-sm uppercase">Overloaded Devs</h4>
              <p className="text-xs text-gray-500">Human reviewers lack time to check every line thoroughly, leaving architectural landmines in codebase margins.</p>
            </div>
            <div className="p-6 rounded-xl border border-white/5 bg-white/[0.01] space-y-2 text-left">
              <h4 className="text-white font-semibold font-mono text-sm uppercase">No Standards Context</h4>
              <p className="text-xs text-gray-500">Standard general AI review tools don't understand your team's specific legacy codebase patterns or conventions.</p>
            </div>
            <div className="p-6 rounded-xl border border-white/5 bg-white/[0.01] space-y-2 text-left">
              <h4 className="text-white font-semibold font-mono text-sm uppercase">Manual Fixes Only</h4>
              <p className="text-xs text-gray-500">Discovering bugs requires manual rewrite, PR re-submission, and secondary validation passes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5 text-center">
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

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5 scroll-mt-24">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">Raptor's Feature Engine</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Everything your engineering team needs to review, secure, and auto-fix code natively in GitHub.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-black border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all text-left">
            <div className="p-3 bg-white/5 w-fit rounded-xl border border-white/10">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">AST-level Code Scans</h3>
            <p className="text-sm text-gray-400">
              Parses the Abstract Syntax Tree of code diffs to verify structural security, performance logic, and catch N+1 query patterns instantly.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-black border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all text-left">
            <div className="p-3 bg-white/5 w-fit rounded-xl border border-white/10">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Semantic Team Memory</h3>
            <p className="text-sm text-gray-400">
              Saves past pull request feedback and accepted/rejected patterns in pgvector. Learns and adapts automatically to enforce custom guidelines.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-black border border-white/10 rounded-2xl p-6 space-y-4 hover:border-white/20 transition-all text-left">
            <div className="p-3 bg-white/5 w-fit rounded-xl border border-white/10">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Auto Fix PR Generation</h3>
            <p className="text-sm text-gray-400">
              Generate fully automated PR branches with correct code fixes. Review details, select issues, and click 'Create Fix PR' to apply them immediately.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="community" className={`max-w-6xl mx-auto px-6 py-16 ${isDark ? 'border-white/5' : 'border-slate-200'} border-t scroll-mt-24`}>
        <div className="max-w-2xl mb-12 text-left">
          <div className={`flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-4 font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'} animate-pulse`}></span>
            From the community
          </div>
          <h2 className={`text-3xl sm:text-5xl font-bold mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            It fits into your life.
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>
            Reviewing code while walking the dog, or checking live pull request scan telemetry from your phone. Raptor moves wherever you are.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((item, idx) => (
            <div 
              key={idx} 
              className={`p-8 rounded-2xl ${isDark ? 'bg-black border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'} border transition-colors text-left`}
            >
              <div className="flex items-center gap-3.5 mb-5 font-sans">
                <img 
                  src={item.avatarUrl} 
                  alt={item.name} 
                  className={`w-10 h-10 rounded-full border shrink-0 object-cover ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-slate-100'}`}
                />
                <div>
                  <div className={`font-bold text-sm tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.name}</div>
                  <div className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>{item.handle}</div>
                </div>
              </div>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={`max-w-6xl mx-auto px-6 py-16 ${isDark ? 'border-white/5' : 'border-slate-200'} border-t scroll-mt-24`}>
        <div className="text-center mb-16 space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600'} border text-xs font-mono uppercase tracking-wider`}>
            <Layers className="w-3.5 h-3.5" /> Predictable Pricing
          </div>
          <h2 className={`text-3xl sm:text-5xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Simple plans for every size</h2>
          <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>
            Get started for free or scale your secure reviews with our team plans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tier 1 */}
          <div className={`rounded-2xl p-8 flex flex-col justify-between text-left transition-all ${isDark ? 'bg-black border border-white/10 hover:border-white/20' : 'bg-slate-50 border border-slate-200 hover:border-slate-300'}`}>
            <div className="space-y-4">
              <div className={`text-xs font-bold font-mono uppercase ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>Hobbyist</div>
              <div className={`text-3xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>$0 <span className={`text-xs font-sans ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>/ month</span></div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>Great for individual developers scanning public source repositories.</p>
              <ul className={`space-y-2 text-xs pt-4 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> 50 scans per month</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Public repositories</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Basic AST parsing</li>
              </ul>
            </div>
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className={`mt-8 block w-full text-center px-4 py-2.5 rounded-lg text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-white/10 text-white border border-white/10 hover:bg-white/15' : 'bg-slate-900/10 text-slate-900 border border-slate-300/40 hover:bg-slate-900/20'}`}
            >
              {isLoggingIn ? 'Connecting...' : 'Get Started'}
            </button>
          </div>

          {/* Tier 2 */}
          <div className={`rounded-2xl p-8 flex flex-col justify-between text-left relative ${isDark ? 'bg-black border-2 border-white' : 'bg-slate-50 border-2 border-slate-900'}`}>
            <div className={`absolute top-0 right-6 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full font-mono ${isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}>Popular</div>
            <div className="space-y-4">
              <div className={`text-xs font-bold font-mono uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>Professional</div>
              <div className={`text-3xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>$49 <span className={`text-xs font-sans ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>/ month</span></div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>Perfect for scaling startup teams requiring memory layers and private repos.</p>
              <ul className={`space-y-2 text-xs pt-4 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Unlimited scans</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Private repositories</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} />pgvector Team Memory</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Convention Rule management</li>
              </ul>
            </div>
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className={`mt-8 block w-full text-center px-4 py-2.5 rounded-lg text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {isLoggingIn ? 'Connecting...' : 'Start Pro Trial'}
            </button>
          </div>

          {/* Tier 3 */}
          <div className={`rounded-2xl p-8 flex flex-col justify-between text-left transition-all ${isDark ? 'bg-black border border-white/10 hover:border-white/20' : 'bg-slate-50 border border-slate-200 hover:border-slate-300'}`}>
            <div className="space-y-4">
              <div className={`text-xs font-bold font-mono uppercase ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>Enterprise</div>
              <div className={`text-3xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>Custom</div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>High-security compliance configurations for multi-org development teams.</p>
              <ul className={`space-y-2 text-xs pt-4 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Custom model hosting (self-hosted)</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Org-wide architectural learning</li>
                <li className="flex items-center gap-2"><Check className={`w-3 h-3 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Dedicated support</li>
              </ul>
            </div>
            <a href="mailto:contact@raptor.dev" className={`mt-8 block w-full text-center px-4 py-2.5 rounded-lg text-xs font-bold uppercase font-mono tracking-wider transition-all ${isDark ? 'bg-white/10 text-white border border-white/10 hover:bg-white/15' : 'bg-slate-900/10 text-slate-900 border border-slate-300/40 hover:bg-slate-900/20'}`}>
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={`max-w-4xl mx-auto px-6 py-16 ${isDark ? 'border-white/5' : 'border-slate-200'} border-t scroll-mt-24`}>
        <div className="text-center mb-12">
          <h2 className={`text-3xl sm:text-5xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Frequently asked questions</h2>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto text-left">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`border rounded-xl overflow-hidden transition-colors ${isDark ? 'border-white/10 bg-black hover:bg-white/[0.01]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
            >
              <button 
                className={`w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className={`font-medium text-sm md:text-base tracking-wide`}>{faq.question}</span>
                {openFaq === idx ? (
                  <Minus className={`w-4 h-4 shrink-0 ml-4 ${isDark ? 'text-gray-400' : 'text-slate-600'}`} />
                ) : (
                  <Plus className={`w-4 h-4 shrink-0 ml-4 ${isDark ? 'text-gray-400' : 'text-slate-600'}`} />
                )}
              </button>
              {openFaq === idx && (
                <div className={`px-6 pb-6 text-sm leading-relaxed ${isDark ? 'border-white/5 text-gray-400' : 'border-slate-200 text-slate-700'} border-t pt-4`}>
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={`max-w-5xl mx-auto px-6 py-16 ${isDark ? 'border-white/5' : 'border-slate-200'} border-t text-center`}>
        <div className={`${isDark ? 'bg-gradient-to-tr from-white/[0.02] to-white/[0.04] border-white/10' : 'bg-gradient-to-tr from-slate-900/5 to-slate-900/10 border-slate-300/20'} border rounded-3xl p-8 sm:p-16 relative overflow-hidden space-y-6`}>
          <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent' : 'bg-gradient-to-br from-blue-500/5 via-transparent to-transparent'} -z-10`} />
          <h2 className={`text-3xl sm:text-5xl font-bold tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Ready to ship secure code faster?</h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-slate-700'} text-sm sm:text-base max-w-lg mx-auto leading-relaxed`}>
            Join engineering teams using Raptor to find vulnerabilities, manage standards, and auto-generate pull request fixes.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handleGithubLogin}
              disabled={isLoggingIn}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-bold text-xs uppercase tracking-wider font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'text-black bg-white hover:bg-gray-200' : 'text-white bg-black hover:bg-slate-800'}`}
            >
              {isLoggingIn ? 'Connecting...' : 'Login with GitHub'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
      
      {/* Footer Section */}
      <footer className={`relative ${isDark ? 'border-white/10 bg-black' : 'border-slate-200 bg-slate-50'} border-t pt-16 pb-16 overflow-hidden`}>
        <div className={`max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-20 relative z-10 text-left`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 font-bold">
              <TRexIcon className={`w-6 h-6`} />
              <span className={`text-lg tracking-tight font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Raptor</span>
            </div>
            <p className={`text-xs leading-relaxed max-w-xs ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>
              Autonomous Abstract Syntax Tree (AST) code scanning with integrated semantic memory layers.
            </p>
          </div>
          
          <div className={`flex flex-col gap-3 font-medium text-sm`}>
            <span className={`text-xs font-bold uppercase font-mono tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>Navigation</span>
            <Link to="/" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Home</Link>
            <Link to="/docs" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Docs</Link>
            <Link to="/blog" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Blog</Link>
            <Link to="/changelog" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Changelog</Link>
          </div>

          <div className={`flex flex-col gap-3 font-medium text-sm`}>
            <span className={`text-xs font-bold uppercase font-mono tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>Legal</span>
            <Link to="/terms" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Terms of Service</Link>
            <Link to="/privacy" className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Privacy Policy</Link>
            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-slate-600'}`}>All rights reserved</span>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className={`text-xs font-medium block mb-1 ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>Contact us</span>
              <a href="mailto:contact@raptor.dev" className={`text-sm font-medium hover:underline transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>contact@raptor.dev</a>
            </div>
            
            <div>
              <span className={`text-xs font-medium block mb-3 ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>Follow us</span>
              <div className="flex gap-3">
                <a href="#" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${isDark ? 'border-white/15 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-900/10 text-slate-900'}`}>
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${isDark ? 'border-white/15 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-900/10 text-slate-900'}`}>
                  <Twitter className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Massive Watermark Text */}
        <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-full px-4 text-center pointer-events-none select-none overflow-hidden">
          <span className={`text-[23vw] font-black tracking-tighter block leading-none font-sans ${isDark ? 'text-white/[0.025]' : 'text-slate-900/[0.05]'}`}>
            RAPTOR
          </span>
        </div>
      </footer>
    </div>
  );
}
