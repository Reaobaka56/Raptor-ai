import { Terminal, ShieldAlert, Zap, ArrowLeft, BookOpen, GitPullRequest, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';
import { startGithubLogin } from '../api';
import { useTheme } from '../theme';

export default function Docs() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleThemeToggle = () => {
    toggleTheme()
  }

  const handleLogin = async () => {
    try {
      await startGithubLogin();
    } catch (error) {
      console.error('GitHub login failed', error);
      window.location.href = '/';
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-black text-gray-300' : 'bg-white text-slate-900'} font-sans ${isDark ? 'selection:bg-white/20 selection:text-white' : 'selection:bg-slate-900/10 selection:text-slate-900'} pb-24`}>
      {/* Header */}
      <nav className={`border-b ${isDark ? 'border-white/10 bg-black/80' : 'border-slate-200 bg-white/95'} sticky top-0 z-50 backdrop-blur-xl px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}> 
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors flex items-center gap-1 text-sm font-mono mr-0 sm:mr-4`}
          >
            <ArrowLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'}`} /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Docs</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm font-medium">
          <button
            type="button"
            onClick={handleThemeToggle}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
          >
            {isDark ? <Sun className="w-4 h-4 text-white" /> : <Moon className="w-4 h-4 text-white" />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
          >
            Login with GitHub
          </button>
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
          <section className={`${isDark ? 'bg-black border-white/10' : 'bg-slate-100 border-slate-200'} p-8 rounded-2xl border space-y-4`}>
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <Terminal className="w-6 h-6 text-white" />
              1. Architecture & Execution Flow
            </div>
            <p className={`${isDark ? 'text-gray-400' : 'text-slate-700'} leading-relaxed text-sm`}>
              When a developer opens or updates a Pull Request, GitHub sends an encrypted webhook payload to Raptor's API gateway. Raptor clones the diff in-memory and parses the Abstract Syntax Tree (AST) across supported runtimes (TypeScript, Python, Go, Java, Rust).
            </p>
          </section>

          <section className={`${isDark ? 'bg-black border-white/10' : 'bg-slate-100 border-slate-200'} p-8 rounded-2xl border space-y-4`}>
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <ShieldAlert className="w-6 h-6 text-white" />
              2. Security Scanning Engine
            </div>
            <p className={`${isDark ? 'text-gray-400' : 'text-slate-700'} leading-relaxed text-sm`}>
              Unlike static linters, Raptor inspects data flow across multiple function boundaries. It catches raw SQL injection strings, broken object-level authentication (BOLA), and hardcoded credential leaks before they reach staging environments.
            </p>
          </section>

          <section className={`${isDark ? 'bg-black border-white/10' : 'bg-slate-100 border-slate-200'} p-8 rounded-2xl border space-y-4`}>
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <Zap className="w-6 h-6 text-white" />
              3. Performance Profiling
            </div>
            <p className={`${isDark ? 'text-gray-400' : 'text-slate-700'} leading-relaxed text-sm`}>
              Raptor automatically highlights hidden N+1 query loops within modern ORMs like Prisma, TypeORM, and Hibernate. It provides immediate inline diff suggestions to convert loops into optimized batch queries.
            </p>
          </section>

          <section className={`${isDark ? 'bg-black border-white/10' : 'bg-slate-100 border-slate-200'} p-8 rounded-2xl border space-y-4`}>
            <div className="flex items-center gap-3 text-white font-bold text-xl">
              <GitPullRequest className="w-6 h-6 text-white" />
              4. GitHub App Configuration
            </div>
            <p className={`${isDark ? 'text-gray-400' : 'text-slate-700'} leading-relaxed text-sm`}>
              To install on your organization, navigate to the Raptor Dashboard, click "Connect GitHub App", and authorize access for your selected repositories. No YAML config files or IDE plugins are required.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
