import { useState, useEffect, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import {
  File, Folder, FolderOpen, Save, Loader2, PlayCircle,
  CheckCircle2, XCircle, RefreshCw, Search,
} from 'lucide-react'
import { sandboxApi } from '../api'

interface FileEntry { path: string; size: number }

interface TreeNode {
  name: string
  path: string
  isFile: boolean
  children: Map<string, TreeNode>
}

function buildTree(files: FileEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: new Map() }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path, isFile, children: new Map() })
      }
      node = node.children.get(part)!
    })
  }
  return root
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', rb: 'ruby',
  json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
  css: 'css', html: 'html', sql: 'sql', sh: 'shell', toml: 'toml',
}
function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return LANGUAGE_BY_EXT[ext] || 'plaintext'
}

function FileTree({ node, depth, activePath, onOpen, filter }: {
  node: TreeNode; depth: number; activePath: string | null
  onOpen: (path: string) => void; filter: string
}) {
  const [open, setOpen] = useState(depth < 1)
  const children = Array.from(node.children.values()).sort(
    (a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name)
  )

  if (filter) {
    const matches = (n: TreeNode): boolean =>
      n.isFile
        ? n.path.toLowerCase().includes(filter.toLowerCase())
        : Array.from(n.children.values()).some(matches)
    if (!matches(node) && depth > 0) return null
  }

  return (
    <div>
      {depth > 0 && (
        <button
          onClick={() => node.isFile ? onOpen(node.path) : setOpen(o => !o)}
          className={`w-full flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition ${
            activePath === node.path ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
          }`}
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {node.isFile ? (
            <File className="h-3.5 w-3.5 flex-none text-gray-600" />
          ) : open ? (
            <FolderOpen className="h-3.5 w-3.5 flex-none text-gray-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 flex-none text-gray-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {(!node.isFile && (open || depth === 0 || filter)) && children.map(child => (
        <FileTree key={child.path} node={child} depth={depth + 1} activePath={activePath} onOpen={onOpen} filter={filter} />
      ))}
    </div>
  )
}

export default function SandboxEditor({ sessionId, running }: { sessionId: string; running: boolean }) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [filter, setFilter] = useState('')
  const [activePath, setActivePath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testCommand, setTestCommand] = useState('')
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<{
    command: string | null; stdout: string; stderr: string; exit_code: number
    blocked: boolean; duration_ms: number; passed: boolean | null
  } | null>(null)

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const res = await sandboxApi.listFiles(sessionId)
      setFiles(res.data)
    } catch { /* noop — empty tree shown */ } finally { setLoadingFiles(false) }
  }, [sessionId])

  useEffect(() => { loadFiles() }, [loadFiles])

  const tree = useMemo(() => buildTree(files), [files])
  const dirty = content !== savedContent && activePath !== null

  const openFile = async (path: string) => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setActivePath(path)
    setLoadingFile(true)
    setSaveError('')
    try {
      const res = await sandboxApi.readFile(sessionId, path)
      setContent(res.data.content)
      setSavedContent(res.data.content)
    } catch (e: any) {
      setContent('')
      setSavedContent('')
      setSaveError(e.response?.data?.detail || 'Failed to open file')
    } finally {
      setLoadingFile(false)
    }
  }

  const save = async () => {
    if (!activePath || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await sandboxApi.writeFile(sessionId, activePath, content)
      setSavedContent(content)
      if (!files.some(f => f.path === activePath)) {
        setFiles(prev => [...prev, { path: activePath, size: content.length }])
      }
    } catch (e: any) {
      setSaveError(e.response?.data?.detail || 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const runTests = async () => {
    setTestRunning(true)
    setTestResult(null)
    try {
      const res = await sandboxApi.runTests(sessionId, testCommand.trim() || undefined)
      setTestResult(res.data)
    } catch (e: any) {
      setTestResult({
        command: testCommand || null, stdout: '',
        stderr: e.response?.data?.detail || 'Failed to run tests',
        exit_code: 1, blocked: false, duration_ms: 0, passed: false,
      })
    } finally {
      setTestRunning(false)
    }
  }

  if (!running) {
    return <div className="flex items-center justify-center py-16 text-gray-600 text-sm">Session must be running to edit files.</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3">
      {/* File tree */}
      <div className="rounded-xl border border-white/10 bg-black flex flex-col max-h-[600px]">
        <div className="flex items-center gap-1.5 border-b border-white/8 px-2 py-2">
          <Search className="h-3.5 w-3.5 text-gray-600 flex-none" />
          <input
            value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter files…"
            className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder:text-gray-700 focus:outline-none"
          />
          <button onClick={loadFiles} title="Refresh file list" className="text-gray-600 hover:text-white transition flex-none">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {loadingFiles ? (
            <div className="flex items-center justify-center py-8 text-gray-600 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading…
            </div>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-600 px-2 py-4">
              Workspace is empty. Run <code className="text-gray-400">git clone</code> in the terminal to check out a repo.
            </p>
          ) : (
            <FileTree node={tree} depth={0} activePath={activePath} onOpen={openFile} filter={filter} />
          )}
        </div>
      </div>

      {/* Editor + test panel */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="rounded-xl border border-white/10 bg-[#1e1e1e] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-black px-3 py-2">
            <span className="text-xs font-mono text-gray-400 truncate">
              {activePath || 'No file open'}
              {dirty && <span className="text-amber-400 ml-1.5">●</span>}
            </span>
            <button
              onClick={save}
              disabled={!activePath || !dirty || saving}
              className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-30 transition flex-none"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="h-[420px]">
            {loadingFile ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading file…
              </div>
            ) : activePath ? (
              <Editor
                height="420px"
                theme="vs-dark"
                path={activePath}
                language={languageFor(activePath)}
                value={content}
                onChange={v => setContent(v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-700 text-sm">
                Select a file from the tree to start editing.
              </div>
            )}
          </div>
          {saveError && <div className="px-3 py-1.5 text-xs text-red-400 border-t border-white/8">{saveError}</div>}
        </div>

        {/* Test runner */}
        <div className="rounded-xl border border-white/10 bg-black p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-gray-500 flex-none" />
            <input
              value={testCommand} onChange={e => setTestCommand(e.target.value)}
              placeholder="Auto-detect test command (or type one, e.g. npm test)"
              className="flex-1 min-w-0 rounded border border-white/10 bg-[#101010] px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <button
              onClick={runTests} disabled={testRunning}
              className="flex items-center gap-1.5 rounded border border-white bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition flex-none"
            >
              {testRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {testRunning ? 'Running…' : 'Run tests'}
            </button>
          </div>

          {testResult && (
            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                {testResult.blocked ? (
                  <span className="text-red-400 font-semibold">Blocked by sandbox policy</span>
                ) : testResult.passed === null ? (
                  <span className="text-gray-500 font-semibold">No result</span>
                ) : testResult.passed ? (
                  <span className="flex items-center gap-1 text-green-400 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Passed</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 font-semibold"><XCircle className="h-3.5 w-3.5" /> Failed</span>
                )}
                {testResult.command && <span className="font-mono text-gray-600">{testResult.command}</span>}
                <span className="text-gray-700 ml-auto">exit {testResult.exit_code} · {testResult.duration_ms}ms</span>
              </div>
              {testResult.stdout && (
                <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">{testResult.stdout}</pre>
              )}
              {testResult.stderr && (
                <pre className="text-[11px] text-red-400/90 whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">{testResult.stderr}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
