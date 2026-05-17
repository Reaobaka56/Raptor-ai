import { ArrowLeft, CheckCircle2, Sparkles, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';

export default function Changelog() {
  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white pb-24">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black sticky top-0 z-50 backdrop-blur-xl bg-black/80 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono mr-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Changelog</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition-all duration-200 font-semibold tracking-wide shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-16 font-sans">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          Changelog & Releases
        </h1>
        <p className="text-lg text-gray-400 mb-16 leading-relaxed">
          Track all recent updates, model improvements, and new language runtime support.
        </p>

        <div className="space-y-16 relative border-l border-white/10 pl-8 ml-4">
          <div className="space-y-4 relative">
            <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white tracking-tight">Raptor v2.0 — Sub-Second PR Reviews</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-green-500/20 text-green-400 border border-green-500/30">Latest</span>
            </div>
            <div className="text-xs font-mono text-gray-500">Released May 15, 2026</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              We have completely revamped our AI analysis engine. By caching AST parses and parallelizing LLM inference, the average Pull Request review latency has dropped from 45 seconds down to 1.2 seconds.
            </p>
            <ul className="space-y-2 text-sm text-gray-300 font-mono bg-white/[0.02] p-4 rounded-xl border border-white/10">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Fully standalone GitHub App integration</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Redesigned premium dark UI and silver T-Rex logo</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Native AST parsing support for Rust and Go</li>
            </ul>
          </div>

          <div className="space-y-4 relative">
            <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-gray-400">
              <Box className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">Raptor v1.5 — Deep SQL Injection & N+1 Detection</div>
            <div className="text-xs font-mono text-gray-500">Released April 10, 2026</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Introduced comprehensive vulnerability scanning for raw database drivers and ORMs. Added automated inline diff replacement generation for 1-click merging on GitHub.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
