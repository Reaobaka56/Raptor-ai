import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Search, Loader2, AlertCircle, MessageSquare, X, ArrowLeft } from 'lucide-react'
import { chatApi, type ChatMessage, type ChatConversation } from '../api'
import { formatDistanceToNow } from 'date-fns'

function Avatar({ url, username, size = 8 }: { url?: string | null; username: string; size?: number }) {
  const s = `h-${size} w-${size}`
  if (url) return <img src={url} alt={username} className={`${s} rounded-full border border-white/10 object-cover flex-none`} />
  return (
    <div className={`${s} rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 flex-none`}>
      {username[0]?.toUpperCase()}
    </div>
  )
}

function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && <Avatar url={msg.sender_avatar} username={msg.sender_username || '?'} size={6} />}
      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isOwn ? 'rounded-br-sm bg-white text-black' : 'rounded-bl-sm bg-white/8 text-gray-200'
      }`}>
        {msg.content}
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-gray-500' : 'text-gray-600'} text-right`}>
          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

function NewConvoSearch({ onSelect, onClose }: { onSelect: (username: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await chatApi.searchUsers(query)
        setResults(res.data)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <p className="text-sm font-bold text-white">New Conversation</p>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-gray-600 flex-none" />
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
              placeholder="Search by username…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none" />
            {loading && <Loader2 className="h-3.5 w-3.5 text-gray-600 animate-spin" />}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {results.map(u => (
              <button key={u.id} onClick={() => { onSelect(u.username); onClose() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition text-left">
                <Avatar url={u.avatar_url} username={u.username} size={7} />
                <div>
                  <p className="text-sm font-semibold text-white">@{u.username}</p>
                  {u.name && <p className="text-xs text-gray-500">{u.name}</p>}
                </div>
              </button>
            ))}
            {query && !loading && results.length === 0 && (
              <p className="text-center py-4 text-sm text-gray-600">No users found</p>
            )}
            {!query && (
              <p className="text-center py-4 text-sm text-gray-600">Type to search for users</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const currentUsername = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').username || '' } catch { return '' }
  })()

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeUsername, setActiveUsername] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [otherUser, setOtherUser] = useState<any>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<number>(0)

  useEffect(() => {
    if (!token) { navigate('/'); return }
    loadConversations()
  }, [token])

  useEffect(() => {
    if (!activeUsername) return
    loadMessages(activeUsername)
    // Poll for new messages every 5 seconds
    pollingRef.current = window.setInterval(() => loadMessages(activeUsername, true), 5000)
    return () => clearInterval(pollingRef.current)
  }, [activeUsername])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await chatApi.getConversations()
      setConversations(res.data)
    } catch { } finally { setLoading(false) }
  }

  const loadMessages = async (username: string, silent = false) => {
    if (!silent) setMsgLoading(true)
    try {
      const res = await chatApi.getMessages(username)
      setMessages(res.data.messages)
      setOtherUser(res.data.other_user)
      if (!silent) loadConversations() // refresh unread counts
    } catch (e: any) {
      if (!silent) setError(e.response?.data?.detail || 'Failed to load messages')
    } finally {
      if (!silent) setMsgLoading(false)
    }
  }

  const openConversation = (username: string) => {
    setActiveUsername(username)
    setMessages([])
    setError('')
  }

  const handleSend = async () => {
    if (!input.trim() || !activeUsername || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await chatApi.sendMessage(activeUsername, text)
      setMessages(prev => [...prev, res.data])
      loadConversations()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to send message')
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-2xl border border-white/10 overflow-hidden">
      {showSearch && (
        <NewConvoSearch
          onSelect={username => openConversation(username)}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`${activeUsername ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r border-white/8 bg-[#0a0a10]`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
          <p className="text-sm font-bold text-white">Messages</p>
          <button onClick={() => setShowSearch(true)}
            className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
            <Search className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
            <MessageSquare className="h-10 w-10 text-gray-700" />
            <p className="text-sm text-gray-500">No conversations yet</p>
            <button onClick={() => setShowSearch(true)}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white hover:text-black transition">
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {conversations.map(conv => (
              <button key={conv.partner_id}
                onClick={() => openConversation(conv.partner_username)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/3 transition text-left ${activeUsername === conv.partner_username ? 'bg-white/5' : ''}`}>
                <Avatar url={conv.partner_avatar} username={conv.partner_username} size={9} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">@{conv.partner_username}</p>
                    <p className="text-[10px] text-gray-600">{formatDistanceToNow(new Date(conv.last_at), { addSuffix: false })}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="flex-none h-5 w-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Message thread ── */}
      {activeUsername ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 bg-[#0a0a10]">
            <button className="md:hidden text-gray-500 hover:text-white transition" onClick={() => setActiveUsername(null)}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Avatar url={otherUser?.avatar_url} username={activeUsername} size={8} />
            <div>
              <p className="text-sm font-bold text-white">@{activeUsername}</p>
              {otherUser?.name && <p className="text-xs text-gray-600">{otherUser.name}</p>}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgLoading && (
              <div className="flex items-center justify-center py-8 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 flex-none" /> {error}
              </div>
            )}
            {!msgLoading && messages.length === 0 && (
              <div className="text-center py-12 text-gray-600 text-sm">
                No messages yet. Say hello!
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isOwn={msg.sender_username === currentUsername} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/8 px-4 py-3 bg-[#0a0a10]">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={`Message @${activeUsername}…`}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
              />
              <button onClick={handleSend} disabled={sending || !input.trim()}
                className="rounded-lg bg-white p-1.5 text-black hover:bg-gray-100 disabled:opacity-40 transition flex-none">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center px-8">
          <div className="space-y-3">
            <MessageSquare className="h-12 w-12 text-gray-700 mx-auto" />
            <p className="text-gray-500 text-sm">Select a conversation or start a new one</p>
            <button onClick={() => setShowSearch(true)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:bg-white hover:text-black transition">
              New message
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
