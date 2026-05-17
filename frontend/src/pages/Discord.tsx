import { ArrowLeft, MessageSquare, ArrowRight, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';

export default function Discord() {
  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white pb-24">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black sticky top-0 z-50 backdrop-blur-xl bg-black/80 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono mr-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Community</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition-all duration-200 font-semibold tracking-wide shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-24 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center mx-auto mb-6 text-[#5865F2]">
          <MessageSquare className="w-8 h-8" />
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-6">
          Join the Developer Hub
        </h1>
        <p className="text-lg text-gray-400 mb-12 max-w-xl mx-auto leading-relaxed">
          Connect with elite engineers, discuss AST security rules, share custom linting benchmarks, and chat directly with the Raptor AI maintainers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-all shadow-[0_0_30px_rgba(88,101,242,0.3)] text-base"
          >
            Open Discord Server <ArrowRight className="w-5 h-5" />
          </a>
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-base"
          >
            Return to Home
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-xl mx-auto border-t border-white/10 pt-12 text-center">
          <div>
            <div className="text-2xl font-bold text-white mb-1">4,820</div>
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider flex items-center justify-center gap-1">
              <Users className="w-3 h-3 text-indigo-400" /> Members
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">1,240</div>
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-green-400" /> Online
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white mb-1">24/7</div>
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Support</div>
          </div>
        </div>
      </main>
    </div>
  );
}
