import { useState, useEffect } from 'react';
import { Folder, Loader2, ArrowLeft, Terminal, Copy, Check } from 'lucide-react';
import { repoExplorerApi, type RepoTreeItem } from '../api';

interface RepoBrowserProps {
  repoFullName: string;
  onClose?: () => void;
}

const LANG_COLORS: Record<string, string> = {
  ts: '#3178c6', tsx: '#3178c6', js: '#f7df1e', jsx: '#f7df1e',
  py: '#3572A5', go: '#00ADD8', rs: '#dea584', java: '#b07219',
  rb: '#701516', css: '#563d7c', html: '#e34c26', md: '#083fa1',
  json: '#292929', yaml: '#cc1018', yml: '#cc1018', sh: '#89e051',
};
function langColor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return LANG_COLORS[ext] || '#888';
}

function FileViewer({ owner, repo, path, onBack }: { owner: string; repo: string; path: string; onBack: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    repoExplorerApi.getFile(owner, repo, path)
      .then(r => setContent(r.data.content))
      .catch(() => setContent('// Error loading file'))
      .finally(() => setLoading(false));
  }, [owner, repo, path]);

  const lines = content?.split('\n') || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-gray-500 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-gray-400 truncate">{path}</span>
          <span className="h-2 w-2 rounded-full flex-none" style={{ background: langColor(path) }} />
        </div>
        {content && (
          <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-white transition">
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-[#0a0a0f] text-sm">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : (
          <table className="w-full text-xs font-mono">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-white/2">
                  <td className="select-none text-right pr-4 pl-4 py-0.5 text-gray-700 border-r border-white/5 w-12">{i + 1}</td>
                  <td className="pl-4 pr-4 py-0.5 text-gray-300 whitespace-pre">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function RepoBrowser({ repoFullName, onClose }: RepoBrowserProps) {
  const [owner, repo] = repoFullName.split('/');
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<RepoTreeItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPath = (path: string) => {
    setLoading(true);
    setError('');
    setSelectedFile(null);
    repoExplorerApi.getTree(owner, repo, path)
      .then(r => {
        setItems(r.data.items || []);
        setCurrentPath(path);
      })
      .catch(() => setError('Failed to load repository tree. Check API limits or repository access.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPath(''); }, [owner, repo]);

  if (error) return (
    <div className="p-8 text-center text-red-400 font-mono text-sm bg-black border border-red-500/20 rounded-xl">{error}</div>
  );

  return (
    <div className="flex flex-col h-full min-h-[600px] border border-white/10 rounded-xl bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-black/40 border-b border-white/10">
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Terminal className="w-4 h-4 text-gray-500" />
        <h3 className="font-mono text-sm font-semibold text-white tracking-tight">{repoFullName}</h3>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 border-r border-white/10 bg-black/20 overflow-y-auto hidden sm:block p-2">
          {currentPath && (
            <button onClick={() => loadPath(currentPath.split('/').slice(0, -1).join('/'))}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-mono text-gray-500 hover:text-white transition mb-1">
              <ArrowLeft className="w-3 h-3" /> ..
            </button>
          )}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-600" /></div>
          ) : (
            <div className="space-y-0.5">
              {items.map(item => {
                const name = item.name;
                const isSelected = selectedFile === item.path;
                return (
                  <button key={item.sha}
                    onClick={() => item.type === 'dir' ? loadPath(item.path) : setSelectedFile(item.path)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm font-mono transition-colors ${
                      isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}>
                    {item.type === 'dir'
                      ? <Folder className="w-3.5 h-3.5 text-blue-400 flex-none" />
                      : <span className="h-2 w-2 rounded-full flex-none" style={{ background: langColor(name) }} />
                    }
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
              {items.length === 0 && (
                <div className="px-2 py-4 text-xs text-gray-600 font-mono italic">Empty directory</div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 bg-[#0d0d14] overflow-y-auto relative">
          {selectedFile ? (
            <FileViewer owner={owner} repo={repo} path={selectedFile} onBack={() => setSelectedFile(null)} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 font-mono text-sm">
              Select a file to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
