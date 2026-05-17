import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white pb-24">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black sticky top-0 z-50 backdrop-blur-xl bg-black/80 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono mr-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Legal</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition-all duration-200 font-semibold tracking-wide shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-16 font-sans">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          Terms of Service
        </h1>
        <div className="text-xs font-mono text-gray-500 mb-12">Last updated: May 15, 2026</div>

        <div className="space-y-8 text-sm leading-relaxed text-gray-400">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">1. Acceptance of Terms</h2>
            <p>
              By installing the Raptor GitHub App or accessing the Raptor web platform, you agree to be bound by these Terms of Service. If you do not agree, do not utilize the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">2. Code Processing & Ephemeral Storage</h2>
            <p>
              Raptor strictly processes code diffs during the Pull Request webhook lifecycle in memory. We do not persist, store, or archive your proprietary source code after the review analysis completes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">3. Service Availability</h2>
            <p>
              We provide the service on an "as is" and "as available" basis without express warranties of uninterrupted continuous availability.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
