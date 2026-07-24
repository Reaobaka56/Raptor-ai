import { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, Zap, GitPullRequest, Menu, X, ChevronRight, Code2, BookOpen, Settings, Webhook, Brain, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';
import { startGithubLogin } from '../api';
import { useTheme } from '../theme';

const sections = [
  { id: 'overview',     label: 'Overview',              icon: BookOpen },
  { id: 'quickstart',   label: 'Quick Start',           icon: Terminal },
  { id: 'architecture', label: 'Architecture',          icon: Settings },
  { id: 'security',     label: 'Security Scanning',     icon: ShieldAlert },
  { id: 'performance',  label: 'Performance Profiling', icon: Zap },
  { id: 'memory',       label: 'Team Memory',           icon: Brain },
  { id: 'github',       label: 'GitHub App Setup',      icon: GitPullRequest },
  { id: 'webhooks',     label: 'Webhooks & API',        icon: Webhook },
  { id: 'config',       label: 'Configuration',         icon: Code2 },
];

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl border border-white/8 bg-[#06060c] overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/6 bg-white/2">
        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-white transition-colors">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-300 font-mono leading-relaxed overflow-x-auto">{code}</pre>
    </div>
  );
}

function SectionContent({ id, isDark }: { id: string; isDark: boolean }) {
  const prose = isDark ? 'text-gray-400' : 'text-slate-600';
// const heading removed as unused
  const subheading = 'text-white font-semibold text-sm mb-2 mt-6';

  switch (id) {
    case 'overview': return (
      <div className="space-y-4">
        <p className={prose}>Raptor is an autonomous AI agent that performs deep contextual code reviews on GitHub Pull Requests within seconds. Unlike linters that check syntax, Raptor understands intent — tracking data flows, detecting security vulnerabilities, and enforcing team conventions across your entire codebase.</p>
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[
            ['Sub-30s reviews', 'Every PR reviewed before the author can make a cup of coffee'],
            ['Auto-fix PRs', 'Issues come with a ready-to-merge fix pull request'],
            ['Team memory', 'Learns your conventions and suppresses false positives'],
            ['Zero config', 'Install and go — no YAML files, no plugins, no infra'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-white/8 bg-white/2 p-4">
              <p className="text-sm font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );

    case 'quickstart': return (
      <div className="space-y-4">
        <p className={prose}>Get Raptor reviewing your first PR in under 60 seconds.</p>
        <p className={`${subheading}`}>Step 1 — Connect your GitHub account</p>
        <p className="text-sm text-gray-500">Click "Get started" on the landing page and authorize Raptor via GitHub OAuth. Raptor only requests the minimum permissions needed to read diffs and post comments.</p>
        <p className={`${subheading}`}>Step 2 — Install on a repository</p>
        <p className="text-sm text-gray-500">From your dashboard, click "Connect GitHub App" and select the repositories you want Raptor to watch. You can add or remove repos at any time.</p>
        <p className={`${subheading}`}>Step 3 — Open a pull request</p>
        <p className="text-sm text-gray-500">Open any pull request on a connected repo. Raptor will post a review comment within 30 seconds with issues found, severity ratings, and fix suggestions.</p>
        <CodeBlock language="bash" code={`# Optional: trigger a manual review via CLI
curl -X POST https://raptor-ai.onrender.com/api/scan \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"repo": "your-org/your-repo", "pr": 42}'`} />
      </div>
    );

    case 'architecture': return (
      <div className="space-y-4">
        <p className={prose}>When a developer opens or updates a Pull Request, GitHub sends an encrypted webhook payload to Raptor's API gateway. Raptor clones the diff in-memory and parses the Abstract Syntax Tree (AST) across supported runtimes.</p>
        <CodeBlock language="text" code={`GitHub PR Event
    │
    ▼
Webhook Receiver (FastAPI)
    │  Signature validated via HMAC-SHA256
    ▼
Diff Parser
    │  AST extraction per language
    ▼
Analysis Pipeline
    ├── Security Scanner
    ├── Performance Profiler  
    ├── Convention Checker (Team Memory)
    └── Quality Auditor
    │
    ▼
Fix Generator (LLM)
    │  Generates patch + explanation
    ▼
GitHub API
    ├── Inline PR comments
    └── Fix pull request`} />
        <p className="text-sm text-gray-500">Supported languages: TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, C#. Code diffs are never persisted — they are analysed in-memory and discarded after each review.</p>
      </div>
    );

    case 'security': return (
      <div className="space-y-4">
        <p className={prose}>Raptor inspects data flow across multiple function boundaries, not just single-line patterns. This catches vulnerabilities that escape traditional static analysis tools.</p>
        <p className={`${subheading}`}>What Raptor catches</p>
        <div className="space-y-2">
          {[
            ['SQL Injection', 'Raw string interpolation in database queries'],
            ['XSS', 'Unescaped user input rendered in HTML contexts'],
            ['BOLA / IDOR', 'Missing ownership checks on resource access'],
            ['Secrets in code', 'API keys, tokens, and credentials committed to source'],
            ['Broken auth', 'Missing rate limits, weak JWT validation, session issues'],
            ['Path traversal', 'User-controlled file paths without sanitisation'],
          ].map(([name, desc]) => (
            <div key={name} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/2 px-4 py-3">
              <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 flex-none" />
              <div>
                <p className="text-xs font-semibold text-white">{name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    case 'performance': return (
      <div className="space-y-4">
        <p className={prose}>Raptor automatically highlights hidden performance issues in modern ORMs and async patterns. It provides inline diff suggestions to fix them without requiring manual profiling.</p>
        <p className={`${subheading}`}>N+1 Query Detection</p>
        <CodeBlock language="typescript" code={`// ❌ Raptor will flag this — N+1 query in a loop
const posts = await db.posts.findMany();
for (const post of posts) {
  post.author = await db.users.findOne({ id: post.authorId });
}

// ✅ Raptor's suggested fix — single batch query
const posts = await db.posts.findMany({
  include: { author: true }
});`} />
        <p className={`${subheading}`}>Other patterns detected</p>
        <ul className="space-y-1.5 text-sm text-gray-500">
          {['Missing database indexes on frequently queried columns', 'Unbounded array operations on large datasets', 'Synchronous file I/O in async contexts', 'Memory leaks in event listeners and timers'].map(p => (
            <li key={p} className="flex items-start gap-2"><span className="text-white/30 mt-1">—</span>{p}</li>
          ))}
        </ul>
      </div>
    );

    case 'memory': return (
      <div className="space-y-4">
        <p className={prose}>After 10 merged PRs, Raptor begins learning your team's specific patterns and conventions. This dramatically reduces false positives and makes reviews feel personalised.</p>
        <div className="rounded-xl border border-white/8 bg-white/2 p-5 space-y-3">
          <p className="text-sm font-semibold text-white">How memory works</p>
          <div className="space-y-2 text-sm text-gray-500">
            <p><span className="text-white">PRs 1–10:</span> Raptor applies all default rules and observes which suggestions your team accepts vs dismisses.</p>
            <p><span className="text-white">PRs 11–50:</span> Suppresses rules that have been consistently dismissed. Boosts severity for issues your team consistently fixes.</p>
            <p><span className="text-white">PRs 50+:</span> Fully personalised reviews with near-zero false positives for your specific codebase.</p>
          </div>
        </div>
        <p className={`${subheading}`}>Adding custom rules</p>
        <CodeBlock language="bash" code={`# Add a convention rule via API
curl -X POST https://raptor-ai.onrender.com/api/memory/rules \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "rule_text": "All API endpoints must include authentication middleware",
    "repo": "your-org/your-repo"
  }'`} />
      </div>
    );

    case 'github': return (
      <div className="space-y-4">
        <p className={prose}>Raptor connects to GitHub via OAuth. No GitHub App installation is required — just authorize Raptor from your dashboard.</p>
        <p className={`${subheading}`}>Required OAuth scopes</p>
        <CodeBlock language="text" code={`repo              — Read/write access to repositories
pull_requests     — Read PR diffs, post review comments  
contents          — Read file contents for context
metadata          — Read repository metadata`} />
        <p className={`${subheading}`}>Webhook events</p>
        <p className="text-sm text-gray-500">Raptor listens for <code className="text-white bg-white/8 px-1.5 py-0.5 rounded text-xs">pull_request</code> events with actions <code className="text-white bg-white/8 px-1.5 py-0.5 rounded text-xs">opened</code>, <code className="text-white bg-white/8 px-1.5 py-0.5 rounded text-xs">synchronize</code>, and <code className="text-white bg-white/8 px-1.5 py-0.5 rounded text-xs">reopened</code>. Webhooks are validated using HMAC-SHA256 signatures.</p>
      </div>
    );

    case 'webhooks': return (
      <div className="space-y-4">
        <p className={prose}>Raptor exposes a REST API and receives GitHub webhooks for real-time PR processing.</p>
        <p className={`${subheading}`}>Webhook endpoint</p>
        <CodeBlock language="text" code={`POST https://raptor-ai.onrender.com/webhook
X-Hub-Signature-256: sha256=<HMAC_SIGNATURE>
Content-Type: application/json`} />
        <p className={`${subheading}`}>Manual scan API</p>
        <CodeBlock language="bash" code={`# Trigger a scan on demand
POST /api/scan
{ "repo": "owner/repo", "pr": 42 }

# Get review results  
GET /api/reviews/:id

# List reviews for a repo
GET /api/reviews?repo=owner/repo&limit=20`} />
      </div>
    );

    case 'config': return (
      <div className="space-y-4">
        <p className={prose}>Raptor works out of the box with zero configuration. For advanced customisation, you can optionally add a <code className="text-white bg-white/8 px-1.5 py-0.5 rounded text-xs">.raptor.json</code> file to your repository root.</p>
        <CodeBlock language="json" code={`{
  "severity_threshold": "medium",
  "ignore_paths": ["dist/", "*.min.js", "migrations/"],
  "languages": ["typescript", "python"],
  "rules": {
    "security": true,
    "performance": true,
    "conventions": true,
    "quality": true
  },
  "auto_fix_pr": true,
  "review_on": ["opened", "synchronize"]
}`} />
        <p className="text-sm text-gray-500">All config is optional. Raptor will use sensible defaults for any omitted fields.</p>
      </div>
    );

    default: return null;
  }
}

export default function Docs() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLogin = async () => {
    try { await startGithubLogin(); }
    catch { window.location.href = '/'; }
  };

  const bg = isDark ? 'bg-black' : 'bg-[#f8f9fa]';
  const text = isDark ? 'text-gray-300' : 'text-slate-800';
  const sidebarBg = isDark ? 'bg-[#06060c]' : 'bg-white';
  const borderColor = isDark ? 'border-white/8' : 'border-slate-200';

  return (
    <div className={`min-h-screen ${bg} ${text} font-sans`}>

      {/* Top nav */}
      <header className={`sticky top-0 z-50 ${isDark ? 'bg-black/90 border-white/8' : 'bg-white/95 border-slate-200'} border-b backdrop-blur-xl`}>
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <button className={`md:hidden rounded border ${isDark ? 'border-white/10 text-gray-400' : 'border-slate-200 text-slate-500'} p-1.5`}
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
              <Menu className="h-4 w-4" />
            </button>
            <Link to="/" className="flex items-center gap-2 text-white">
              <TRexIcon className="h-5 w-5" />
              <span className="text-sm font-bold">Raptor AI</span>
            </Link>
            <span className={`hidden sm:block text-xs ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>/ Docs</span>
          </div>
          <div className="flex items-center gap-2">

            <button onClick={handleLogin}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-gray-100 transition">
              Get started
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed md:sticky top-14 h-[calc(100vh-3.5rem)] w-64 flex-none overflow-y-auto z-40
          ${sidebarBg} border-r ${borderColor}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          transition-transform duration-200
        `}>
          {/* Mobile close */}
          <button className={`md:hidden absolute top-3 right-3 rounded border ${isDark ? 'border-white/10 text-gray-500' : 'border-slate-200 text-slate-400'} p-1`}
            onClick={() => setMobileSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>

          <div className="p-4 pt-5">
            <p className={`text-[10px] font-mono uppercase tracking-widest mb-3 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
              Documentation
            </p>
            <nav className="space-y-0.5">
              {sections.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button key={id} onClick={() => scrollTo(id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-all ${
                      active
                        ? isDark ? 'bg-white/8 text-white font-semibold' : 'bg-slate-100 text-slate-900 font-semibold'
                        : isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}>
                    <Icon className={`h-3.5 w-3.5 flex-none ${active ? 'text-white' : isDark ? 'text-gray-600' : 'text-slate-400'}`} />
                    {label}
                    {active && <ChevronRight className="h-3 w-3 ml-auto text-gray-500" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 md:px-12 py-10 max-w-3xl">
          {/* Hero */}
          <div className="mb-12">
            <div className={`flex items-center gap-2 text-xs font-mono uppercase tracking-widest mb-3 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
              <BookOpen className="h-3.5 w-3.5" /> Official Documentation
            </div>
            <h1 className={`text-4xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Raptor AI Documentation
            </h1>
            <p className={`text-lg leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Everything you need to connect Raptor to your repositories and start catching bugs before they ship.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-16">
            {sections.map(({ id, label, icon: Icon }) => (
              <section
                key={id}
                id={id}
                ref={el => { sectionRefs.current[id] = el; }}
                className="scroll-mt-20"
              >
                <div className={`flex items-center gap-3 mb-6 pb-4 border-b ${borderColor}`}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                    <Icon className={`h-4 w-4 ${isDark ? 'text-white' : 'text-slate-700'}`} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</h2>
                </div>
                <SectionContent id={id} isDark={isDark} />
              </section>
            ))}
          </div>

          {/* Footer CTA */}
          <div className={`mt-20 rounded-2xl border ${isDark ? 'border-white/8 bg-white/2' : 'border-slate-200 bg-slate-50'} p-8 text-center`}>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ready to start reviewing PRs?</p>
            <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>Connect your first repository in 60 seconds. Free forever for open source.</p>
            <button onClick={handleLogin}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black hover:bg-gray-100 transition">
              Get started free
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
