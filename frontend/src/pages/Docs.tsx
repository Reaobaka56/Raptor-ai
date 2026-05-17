import { Terminal, ShieldAlert, Zap, ArrowLeft, BookOpen, GitPullRequest } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';

export default function Docs() {
  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white pb-24">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black sticky top-0 z-50 backdrop-blur-xl bg-black/80 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono mr-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Docs</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition-all duration-200 font-semibold tracking-wide shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-16">
        <div className="flex items-center gap-2.5 text-xs font-mono text-indigo-400 uppercase tracking-widest mb-3">
          <BookOpen className="w-4 h-4" /> Official Documentation
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
          Getting Started with Raptor AI
        </h1>
        <p className="text-lg text-gray-400 mb-12 leading-relaxed">
          Raptor is an autonomous AI agent designed to perform deep contextual code reviews on your GitHub Pull Requests within seconds.
        </p>

        <div className="space-y-12 font-sans">
          <section className="p-8 rounded-2xl bg-black border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <Terminal className="w-6 h-6 text-indigo-400" />
              1. Architecture & Execution Flow
            </div>
            <p className="text-gray-400 leading-relaxed text-sm">
              When a developer opens or updates a Pull Request, GitHub sends an encrypted webhook payload to Raptor's API gateway. Raptor clones the diff in-memory and parses the Abstract Syntax Tree (AST) across supported runtimes (TypeScript, Python, Go, Java, Rust).
            </p>
          </section>

          <section className="p-8 rounded-2xl bg-black border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              2. Security Scanning Engine
            </div>
            <p className="text-gray-400 leading-relaxed text-sm">
              Unlike static linters, Raptor inspects data flow across multiple function boundaries. It catches raw SQL injection strings, broken object-level authentication (BOLA), and hardcoded credential leaks before they reach staging environments.
            </p>
          </section>

          <section className="p-8 rounded-2xl bg-black border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <Zap className="w-6 h-6 text-yellow-400" />
              3. Performance Profiling
            </div>
            <p className="text-gray-400 leading-relaxed text-sm">
              Raptor automatically highlights hidden N+1 query loops within modern ORMs like Prisma, TypeORM, and Hibernate. It provides immediate inline diff suggestions to convert loops into optimized batch queries.
            </p>
          </section>

          <section className="p-8 rounded-2xl bg-black border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <GitPullRequest className="w-6 h-6 text-green-400" />
              4. GitHub App Configuration
            </div>
            <p className="text-gray-400 leading-relaxed text-sm">
              To install on your organization, navigate to the Raptor Dashboard, click "Connect GitHub App", and authorize access for your selected repositories. No YAML config files or IDE plugins are required.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
