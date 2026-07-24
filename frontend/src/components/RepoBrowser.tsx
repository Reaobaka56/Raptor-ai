import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, File as FileIcon, Loader2, ArrowLeft, Terminal } from 'lucide-react';
import { reposApi } from '../api';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface RepoBrowserProps {
  repoFullName: string; // e.g. "owner/repo"
  onClose?: () => void;
}

export default function RepoBrowser({ repoFullName, onClose }: RepoBrowserProps) {
  const [owner, repo] = repoFullName.split('/');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<TreeItem | null>(null);

  const { data: treeData, isLoading, error } = useQuery({
    queryKey: ['repo-tree', repoFullName],
    queryFn: () => reposApi.getRepoTree(owner, repo).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="font-mono text-sm">Loading repository structure...</span>
      </div>
    );
  }

  if (error || !treeData?.tree) {
    return (
      <div className="p-8 text-center text-red-400 font-mono text-sm bg-black border border-red-500/20 rounded-xl">
        Failed to load repository tree. Check API limits or repository access.
      </div>
    );
  }

  // Filter items in the current directory
  const currentItems = treeData.tree.filter((item: TreeItem) => {
    // If we're at root, item path shouldn't contain '/'
    if (!currentPath) return !item.path.includes('/');
    
    // If we're in a folder, item path should start with folder + '/' and not have any more '/'
    if (item.path.startsWith(currentPath + '/')) {
      const remainingPath = item.path.substring(currentPath.length + 1);
      return !remainingPath.includes('/');
    }
    return false;
  }).sort((a: TreeItem, b: TreeItem) => {
    // Folders first
    if (a.type === 'tree' && b.type !== 'tree') return -1;
    if (a.type !== 'tree' && b.type === 'tree') return 1;
    return a.path.localeCompare(b.path);
  });

  const handleNavigate = (item: TreeItem) => {
    if (item.type === 'tree') {
      setCurrentPath(item.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(item);
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFile(null);
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] border border-white/10 rounded-xl bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
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
        {/* Sidebar / Tree View */}
        <div className="w-1/3 border-r border-white/10 bg-black/20 overflow-y-auto hidden sm:block p-2">
          <div className="mb-2 flex items-center text-xs font-mono text-gray-500 px-2 pt-1">
            {currentPath ? (
              <button 
                onClick={handleNavigateUp}
                className="hover:text-white flex items-center gap-1 transition"
              >
                <ArrowLeft className="w-3 h-3" /> ../{currentPath.split('/').pop()}
              </button>
            ) : (
              <span className="text-gray-600">/root</span>
            )}
          </div>
          <div className="space-y-0.5">
            {currentItems.map((item: TreeItem) => {
              const name = item.path.split('/').pop();
              const isSelected = selectedFile?.path === item.path;
              return (
                <button
                  key={item.sha}
                  onClick={() => handleNavigate(item)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm font-mono transition-colors ${
                    isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.type === 'tree' ? (
                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <FileIcon className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
            {currentItems.length === 0 && (
              <div className="px-2 py-4 text-xs text-gray-600 font-mono italic">Empty directory</div>
            )}
          </div>
        </div>

        {/* File Content View */}
        <div className="flex-1 bg-[#0d0d14] overflow-y-auto relative">
          {selectedFile ? (
            <FileViewer owner={owner} repo={repo} item={selectedFile} />
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

function FileViewer({ owner, repo, item }: { owner: string; repo: string; item: TreeItem }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['repo-file', owner, repo, item.path],
    queryFn: () => reposApi.getRepoFileContent(owner, repo, item.path).then(r => r.data),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-400 font-mono text-sm">
        Failed to load file contents.
      </div>
    );
  }

  // GitHub returns base64 encoded content
  let content = '';
  try {
    if (data.encoding === 'base64') {
      content = decodeURIComponent(escape(atob(data.content)));
    } else {
      content = data.content || '';
    }
  } catch (e) {
    content = 'Error decoding file contents (possibly binary file).';
  }

  const extension = item.path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript', 'jsx': 'jsx',
    'ts': 'typescript', 'tsx': 'tsx',
    'py': 'python', 'json': 'json',
    'md': 'markdown', 'css': 'css',
    'html': 'html', 'sh': 'bash'
  };
  const language = languageMap[extension] || 'text';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
        <span className="font-mono text-xs text-gray-400">{item.path}</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-500 uppercase">
          {language}
        </span>
      </div>
      <div className="flex-1 overflow-auto bg-[#0a0a0f] text-sm custom-scrollbar">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.5'
          }}
          showLineNumbers={true}
          wrapLines={true}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
