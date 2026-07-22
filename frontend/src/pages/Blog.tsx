import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, User, ArrowRight, Plus, Edit2, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRexIcon } from '../components/TRexIcon';
import { blogApi, userApi, type BlogPost } from '../api';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Admin: create/edit form ────────────────────────────────────────────────────
function PostForm({ post, onSave, onCancel }: {
  post?: BlogPost | null;
  onSave: (data: Partial<BlogPost>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [category, setCategory] = useState(post?.category ?? 'Engineering');
  const [published, setPublished] = useState(post?.published ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title, summary, content, category, published });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d0d14] p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold text-white">{post ? 'Edit Post' : 'New Post'}</h2>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30" />
        <input value={summary} onChange={e => setSummary(e.target.value)}
          placeholder="Summary (short)"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-[#0d0d14] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
          {['Engineering', 'Performance', 'Security', 'Productivity', 'Announcement'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Post content (markdown supported)"
          rows={8}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 font-mono resize-y" />
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
            className="rounded border-white/20 bg-white/5" />
          Publish immediately
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-lg border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onCancel}
            className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/30 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editPost, setEditPost] = useState<BlogPost | null | undefined>(undefined); // undefined = closed
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    void loadPosts();
    if (token) {
      userApi.isAdmin().then(r => setIsAdmin(r.data.isAdmin)).catch(() => {});
    }
  }, [token]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await blogApi.list();
      setPosts(res.data);
    } catch {
      // DB unavailable — graceful empty state
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Partial<BlogPost>) => {
    if (editPost) {
      await blogApi.update(editPost.slug, data);
    } else {
      await blogApi.create(data);
    }
    setEditPost(undefined);
    await loadPosts();
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await blogApi.delete(slug);
    setSelectedPost(null);
    await loadPosts();
  };

  const handleTogglePublish = async (post: BlogPost) => {
    await blogApi.update(post.slug, { published: !post.published });
    await loadPosts();
  };

  // ── Single post view ──────────────────────────────────────────────────────
  if (selectedPost) {
    return (
      <div className="min-h-screen bg-black text-gray-300 font-sans pb-24">
        <nav className="border-b border-white/10 bg-black/80 sticky top-0 z-50 backdrop-blur-xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPost(null)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-mono transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <TRexIcon className="w-6 h-6 text-white" />
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => { setEditPost(selectedPost); setSelectedPost(null); }}
                className="flex items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/30 transition">
                <Edit2 className="h-3 w-3" /> Edit
              </button>
              <button onClick={() => handleDelete(selectedPost.slug)}
                className="flex items-center gap-1.5 rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400 transition">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}
        </nav>
        <main className="max-w-3xl mx-auto px-6 pt-14">
          <span className="inline-block px-2.5 py-1 rounded bg-white/5 text-indigo-400 font-semibold text-xs font-mono mb-4">
            {selectedPost.category}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">{selectedPost.title}</h1>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-500 mb-10">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(selectedPost.published_at)}</span>
            {selectedPost.author_username && (
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {selectedPost.author_username}</span>
            )}
          </div>
          {selectedPost.content ? (
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
              {selectedPost.content}
            </div>
          ) : (
            <p className="text-gray-500 italic">No content yet.</p>
          )}
        </main>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans pb-24">
      {editPost !== undefined && (
        <PostForm
          post={editPost}
          onSave={handleSave}
          onCancel={() => setEditPost(undefined)}
        />
      )}

      <nav className="border-b border-white/10 bg-black/80 sticky top-0 z-40 backdrop-blur-xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <TRexIcon className="w-6 h-6 text-white" />
          <span className="text-white font-bold tracking-tight text-lg">Raptor Blog</span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setEditPost(null)}
              className="flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black transition">
              <Plus className="h-3.5 w-3.5" /> New Post
            </button>
          )}
          <Link to="/dashboard" className="px-3.5 py-1.5 rounded text-xs bg-white/85 text-black hover:bg-white transition font-semibold">
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

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-600">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <p className="text-sm">No posts published yet.</p>
            {isAdmin && (
              <button onClick={() => setEditPost(null)}
                className="mt-4 flex items-center gap-2 mx-auto rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white hover:text-black transition">
                <Plus className="h-4 w-4" /> Write the first post
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.id}
                className="p-8 rounded-2xl bg-black border border-white/10 hover:border-white/25 transition-all space-y-4 relative group">
                {/* Admin badges */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleTogglePublish(post)}
                      title={post.published ? 'Unpublish' : 'Publish'}
                      className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white hover:border-white/30 transition">
                      {post.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setEditPost(post)}
                      className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white hover:border-white/30 transition">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(post.slug)}
                      className="rounded border border-red-500/20 p-1.5 text-red-400/60 hover:text-red-400 hover:border-red-400/50 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span className="px-2.5 py-1 rounded bg-white/5 text-indigo-400 font-semibold">{post.category}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(post.published_at)}</span>
                  {post.author_username && (
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.author_username}</span>
                  )}
                  {isAdmin && !post.published && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">DRAFT</span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white tracking-tight">{post.title}</h2>
                {post.summary && <p className="text-gray-400 text-sm leading-relaxed">{post.summary}</p>}

                <div className="pt-2">
                  <button onClick={() => setSelectedPost(post)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-white tracking-wider uppercase hover:underline">
                    Read article <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
