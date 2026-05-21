import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  Github, 
  Twitter, 
  Linkedin, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Check
} from 'lucide-react';
import { TRexIcon } from '../components/TRexIcon';
import GitHubLoginButton from '../components/GitHubLoginButton'

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white overflow-x-hidden">
      {/* Navbar (Matching Screenshot 1) */}
      <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TRexIcon className="w-7 h-7 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
            <span className="text-white font-bold text-lg tracking-tight">Raptor</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide">
            <Link to="/docs" className="text-gray-400 hover:text-white transition-colors">Docs</Link>
            <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
            <Link to="/changelog" className="text-gray-400 hover:text-white transition-colors">Changelog</Link>
            <Link to="/discord" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
              Discord <Github className="w-3.5 h-3.5"/>
            </Link>
          </div>
          <div className="flex items-center gap-4 font-sans">
            <Link 
              to="/dashboard" 
              className="px-4 py-1.5 rounded text-xs font-semibold bg-white/85 text-black hover:bg-white transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              <GitHubLoginButton />
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section (Inspired by Screenshot 4 Cinematic Glow) */}
      <main className="relative pt-32 pb-24">
        {/* Cinematic Ambient Backlighting & Blurred Raptor Background Logo */}
        <div className="absolute top-[350px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-amber-600/20 via-orange-500/10 to-transparent blur-[140px] -z-10 pointer-events-none rounded-full" />
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-br from-indigo-600/15 via-transparent to-transparent blur-[120px] -z-10 pointer-events-none rounded-full" />
        
        <div className="absolute top-[120px] sm:top-[160px] left-1/2 -translate-x-1/2 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] text-white/10 blur-[40px] sm:blur-[60px] -z-10 pointer-events-none select-none flex items-center justify-center">
          <TRexIcon className="w-full h-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-6 pt-12 pb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-[1.15]">
            Real-time PR diff analysis.<br />
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              Autonomous code review.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed font-normal">
            Raptor AI is an autonomous code review and static analysis platform. Unlike regex-bound linters, it combines AST-level analysis with semantic reasoning to catch high-impact issues in context and generate reliable, inline fixes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 font-sans">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-black bg-white/85 hover:bg-white transition-all duration-200 shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.35)] text-sm tracking-wide"
            >
              Connect GitHub App
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 text-sm tracking-wide backdrop-blur-md"
            >
              <Terminal className="w-4 h-4 text-gray-400" />
              View Live Demo
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 mb-20">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-10">
            <p className="text-white text-xl md:text-2xl font-semibold mb-6">“The AI security engineer inside every pull request.”</p>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-mono tracking-[0.2em] uppercase text-gray-500 mb-3">Why teams switch</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Trust: precise findings with code-aware explanations.</li>
                  <li>• Speed: real-time analysis on every pull request diff.</li>
                  <li>• Precision: AST + semantic hybrid reasoning, not shallow pattern matching.</li>
                  <li>• Workflow: native GitHub comments, inline suggestions, and automated remediation PRs.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-mono tracking-[0.2em] uppercase text-gray-500 mb-3">Core moat</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Repository context memory.</li>
                  <li>• AST + semantic hybrid analysis.</li>
                  <li>• Automated fix generation.</li>
                  <li>• Org-wide architectural learning.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* High-Fidelity Cinematic PR Review Interface Mockup */}
        <div id="demo" className="max-w-5xl mx-auto px-6 mt-4 mb-32 relative">
          <div className="relative rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-2xl overflow-hidden font-mono">
            {/* Window Controls Bar (Red, Yellow, Green dots preserved) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="text-xs text-gray-400 ml-4">github.com/organization/api-gateway/pull/88</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white/5 text-gray-300 border border-white/10">
                  <Check className="w-3.5 h-3.5 text-white" /> status: ready
                </span>
              </div>
            </div>

            {/* Simulated PR Review Content (Monochrome / Terminal Inspired) */}
            <div className="p-6 sm:p-8 space-y-6 bg-black">
              {/* Review Header */}
              <div className="flex items-start gap-4 font-sans">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <TRexIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">Raptor</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-gray-300 border border-white/20">bot</span>
                    <span className="text-xs text-gray-500 ml-1">left a review comment 1m ago</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 bg-white/5 px-3 py-1.5 rounded inline-block border border-white/10">
                    Target diff: <span className="text-white font-semibold">src/controllers/paymentController.ts</span>
                  </p>
                </div>
              </div>

              {/* Vulnerability Banner (Monochrome) */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/15 space-y-2">
                <div className="flex items-center gap-2 font-mono font-bold">
                  <ShieldAlert className="w-5 h-5 text-white shrink-0" />
                  <span className="text-white text-sm tracking-wide">CRITICAL: Severe SQL Injection Vulnerability Detected</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed font-mono">
                  Direct string concatenation detected in raw database query parameter. Unsanitized input from <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">req.body.customerId</code> permits arbitrary query execution.
                </p>
              </div>

              {/* Code Snippet Comparison (Monochrome Terminal Style) */}
              <div className="rounded-xl border border-white/15 overflow-hidden font-mono text-xs sm:text-sm">
                <div className="bg-white/[0.05] px-4 py-2 border-b border-white/10 flex items-center justify-between text-xs text-gray-400">
                  <span>Diff Changes</span>
                  <span className="text-gray-500 font-mono">Lines 42-45</span>
                </div>
                <div className="bg-black divide-y divide-white/5 font-mono">
                  <div className="flex items-center px-4 py-2 text-gray-500 bg-white/[0.02] overflow-x-auto line-through">
                    <span className="w-8 select-none text-gray-600">-</span>
                    <span className="text-gray-500 whitespace-nowrap">const invoice = await db.raw(`SELECT * FROM invoices WHERE id = '${`req.body.customerId`}'`);</span>
                  </div>
                  <div className="flex items-center px-4 py-2 text-white bg-white/[0.07] font-semibold overflow-x-auto border-l-2 border-white">
                    <span className="w-8 select-none text-white">+</span>
                    <span className="text-white whitespace-nowrap">const invoice = await db.query('SELECT * FROM invoices WHERE id = $1', [req.body.customerId]);</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Monochrome) */}
              <div className="flex items-center gap-3 pt-2 font-mono font-semibold">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs bg-white text-black hover:bg-gray-200 transition-colors uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-black" /> Apply Fix Directly
                </button>
                <button className="px-4 py-2 rounded text-xs bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 transition-colors uppercase tracking-wider">
                  Explain Issue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Community / Testimonial Section (Matching Screenshot 2 precisely) */}
        <div id="community" className="max-w-6xl mx-auto px-6 mb-32 pt-16">
          <div className="max-w-2xl mb-16">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-blue-400 uppercase mb-4 font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              From the community
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              It fits into your life.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed font-normal">
              Walking the dog while shipping a feature. Picking up the kids while fixing a bug. At the gym while pushing a startup forward. If inspiration hit away from your desk, it had to wait. Now it doesn't.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
            {testimonials.map((item, idx) => (
              <div 
                key={idx} 
                className="p-8 rounded-2xl bg-black border border-white/10 hover:border-white/20 transition-colors shadow-none"
              >
                <div className="flex items-center gap-3.5 mb-5 font-sans">
                  <img 
                    src={item.avatarUrl} 
                    alt={item.name} 
                    className="w-10 h-10 rounded-full border border-white/10 shrink-0 bg-white/5 object-cover"
                  />
                  <div>
                    <div className="text-white font-bold text-sm tracking-wide">{item.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{item.handle}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed font-normal">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section (Matching Screenshot 1 precisely) */}
        <div id="faq" className="max-w-4xl mx-auto px-6 mb-32 pt-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Frequently asked questions</h2>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto font-sans">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="border border-white/10 rounded-xl bg-black overflow-hidden transition-colors hover:bg-white/[0.02] shadow-none"
              >
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span className="text-white font-medium text-sm md:text-base tracking-wide">{faq.question}</span>
                  {openFaq === idx ? (
                    <Minus className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                  ) : (
                    <Plus className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-6 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>
      
      {/* Minimalist Premium Footer (Matching Screenshot 3 precisely) */}
      <footer className="relative border-t border-white/10 bg-black pt-16 pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-20 relative z-10 font-sans">
          <div>
            <div className="flex items-center gap-3 mb-6 font-bold">
              <TRexIcon className="w-6 h-6 text-white" />
              <span className="text-white text-lg tracking-tight font-bold">Raptor</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 font-medium text-sm">
            <Link to="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link to="/docs" className="text-gray-400 hover:text-white transition-colors">Docs</Link>
            <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
            <Link to="/changelog" className="text-gray-400 hover:text-white transition-colors">Changelog</Link>
            <Link to="/discord" className="text-gray-400 hover:text-white transition-colors">Discord</Link>
          </div>

          <div className="flex flex-col gap-3 font-medium text-xs text-gray-500 pt-1">
            <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <span>All rights reserved</span>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-1">Contact us</span>
              <a href="mailto:contact@raptor.dev" className="text-white text-sm font-medium hover:underline">contact@raptor.dev</a>
            </div>
            
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-3">Follow us</span>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-white">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-white">
                  <Twitter className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <span className="text-xs text-gray-600 mt-2 font-mono">© 2026 — Raptor AI</span>
          </div>
        </div>

        {/* Massive Watermark Text at the bottom (Matching Screenshot 3 "Omnara" watermark) */}
        <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-full px-4 text-center pointer-events-none select-none overflow-hidden">
          <span className="text-[23vw] font-black text-white/[0.025] tracking-tighter block leading-none font-sans">
            RAPTOR
          </span>
        </div>
      </footer>
    </div>
  );
}
