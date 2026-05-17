import { ArrowLeft, Calendar, User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';

export default function Blog() {
  const posts = [
    {
      title: "How Raptor Catches Complex SQL Injections in ASTs",
      summary: "Traditional static analysis linters produce high false-positive rates. Learn how Raptor combines AST parsing with LLM context to spot hidden SQL vulnerabilities across file boundaries.",
      date: "May 14, 2026",
      author: "Travis Carter",
      category: "Engineering"
    },
    {
      title: "Eliminating N+1 Queries in Prisma and TypeORM Automatically",
      summary: "N+1 database queries silently destroy production API throughput. Here is how Raptor spots loop-based database calls during the Pull Request lifecycle and writes the batch fix for you.",
      date: "April 28, 2026",
      author: "Maya Kushner",
      category: "Performance"
    },
    {
      title: "The Evolution of Autonomous Code Reviews",
      summary: "Why engineering teams are moving away from manual nitpicking and letting AI handle security guardrails and style guides directly inside GitHub.",
      date: "April 12, 2026",
      author: "Elaine",
      category: "Productivity"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans selection:bg-white/20 selection:text-white pb-24">
      {/* Header */}
      <nav className="border-b border-white/10 bg-black sticky top-0 z-50 backdrop-blur-xl bg-black/80 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono mr-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Blog</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition-all duration-200 font-semibold tracking-wide shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          Latest Engineering Updates
        </h1>
        <p className="text-lg text-gray-400 mb-16 leading-relaxed">
          Deep dives into AI static analysis, security vulnerabilities, and high-velocity developer workflows.
        </p>

        <div className="space-y-8">
          {posts.map((post, idx) => (
            <article key={idx} className="p-8 rounded-2xl bg-black border border-white/10 hover:border-white/25 transition-all space-y-4">
              <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                <span className="px-2.5 py-1 rounded bg-white/5 text-indigo-400 font-semibold">{post.category}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {post.date}</span>
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.author}</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{post.title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed">{post.summary}</p>
              <div className="pt-2">
                <button className="inline-flex items-center gap-1.5 text-xs font-mono text-white tracking-wider uppercase hover:underline">
                  Read article <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
