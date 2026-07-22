import { useState } from 'react'
import { Calendar, Clock, Plus, X, Check, ChevronLeft, ChevronRight, Video, Users } from 'lucide-react'

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  duration: number
  attendees: string[]
  type: 'review' | 'planning' | 'retro' | 'sync'
  link?: string
}

const TYPE_COLORS: Record<string, string> = {
  review:   'bg-red-500/15 text-red-400 border-red-500/20',
  planning: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  retro:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  sync:     'bg-green-500/15 text-green-400 border-green-500/20',
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function MeetingForm({ onSave, onClose }: { onSave: (m: Omit<Meeting,'id'>) => void; onClose: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(30)
  const [type, setType] = useState<Meeting['type']>('sync')
  const [attendee, setAttendee] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [link, setLink] = useState('')

  const addAttendee = () => {
    if (attendee.trim() && !attendees.includes(attendee.trim())) {
      setAttendees(prev => [...prev, attendee.trim()])
      setAttendee('')
    }
  }

  const handleSave = () => {
    if (!title.trim() || !date) return
    onSave({ title, date, time, duration, attendees, type, link: link || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d14] p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">New Meeting</h2>
          <button onClick={onClose} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Meeting title"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Duration (min)</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-[#0d0d14] px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
              {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d}m</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Type</label>
            <select value={type} onChange={e => setType(e.target.value as Meeting['type'])}
              className="w-full rounded-lg border border-white/10 bg-[#0d0d14] px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
              <option value="sync">Sync</option>
              <option value="review">Code Review</option>
              <option value="planning">Planning</option>
              <option value="retro">Retro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Meeting link (optional)</label>
          <input value={link} onChange={e => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30" />
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Attendees (GitHub usernames)</label>
          <div className="flex gap-2">
            <input value={attendee} onChange={e => setAttendee(e.target.value)}
              placeholder="username"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30"
              onKeyDown={e => e.key === 'Enter' && addAttendee()} />
            <button onClick={addAttendee}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white hover:text-black transition">
              Add
            </button>
          </div>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attendees.map(a => (
                <span key={a} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                  @{a}
                  <button onClick={() => setAttendees(prev => prev.filter(x => x !== a))} className="text-gray-600 hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex items-center gap-2 rounded border border-white bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100 disabled:opacity-50 transition">
            <Check className="h-4 w-4" /> Schedule
          </button>
          <button onClick={onClose}
            className="rounded border border-white/10 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/30 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [meetings, setMeetings] = useState<Meeting[]>([
    { id: '1', title: 'PR Review — auth-service', date: new Date().toISOString().split('T')[0], time: '10:00', duration: 30, attendees: ['team'], type: 'review', link: 'https://meet.google.com' },
    { id: '2', title: 'Sprint Planning', date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], time: '14:00', duration: 60, attendees: ['team'], type: 'planning' },
  ])
  const [showForm, setShowForm] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = now.getDate()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1) }

  const meetingsForDay = (day: number) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return meetings.filter(m => m.date === dateStr)
  }

  const handleSave = (data: Omit<Meeting,'id'>) => {
    setMeetings(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    setShowForm(false)
  }

  const todayMeetings = meetings.filter(m => m.date === now.toISOString().split('T')[0])
  const upcomingMeetings = meetings
    .filter(m => m.date >= now.toISOString().split('T')[0])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {showForm && <MeetingForm onSave={handleSave} onClose={() => setShowForm(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule code reviews, planning sessions, and team syncs</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100 transition">
          <Plus className="h-4 w-4" /> New Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Calendar grid ── */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d14] p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">{MONTHS[month]} {year}</h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
                className="rounded border border-white/10 px-3 py-1 text-xs text-gray-500 hover:text-white transition">
                Today
              </button>
              <button onClick={nextMonth} className="rounded border border-white/10 p-1.5 text-gray-500 hover:text-white transition">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-mono uppercase text-gray-600 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-[#0d0d14] aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayMeetings = meetingsForDay(day)
              const isToday = isCurrentMonth && day === today
              const isSelected = selectedDay === day
              return (
                <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`bg-[#0d0d14] aspect-square flex flex-col items-center justify-start pt-1.5 px-1 transition-colors hover:bg-white/5 ${isSelected ? 'ring-1 ring-inset ring-white/30' : ''}`}>
                  <span className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-white text-black font-bold' : 'text-gray-400'
                  }`}>{day}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                    {dayMeetings.slice(0,3).map(m => (
                      <span key={m.id} className={`h-1 w-1 rounded-full ${
                        m.type === 'review' ? 'bg-red-400' :
                        m.type === 'planning' ? 'bg-indigo-400' :
                        m.type === 'retro' ? 'bg-amber-400' : 'bg-green-400'
                      }`} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected day meetings */}
          {selectedDay && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-mono text-gray-600">{MONTHS[month]} {selectedDay}</p>
              {meetingsForDay(selectedDay).length === 0 ? (
                <p className="text-sm text-gray-600">No meetings. <button onClick={() => setShowForm(true)} className="text-white hover:underline">Schedule one?</button></p>
              ) : meetingsForDay(selectedDay).map(m => (
                <div key={m.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${TYPE_COLORS[m.type]}`}>
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.title}</p>
                    <p className="text-xs opacity-70">{m.time} · {m.duration}min</p>
                  </div>
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noreferrer"
                      className="rounded border border-current px-2 py-1 text-[10px] font-semibold hover:opacity-80 transition flex items-center gap-1">
                      <Video className="h-3 w-3" /> Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Today */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-600">Today</p>
              <Calendar className="h-3.5 w-3.5 text-gray-600" />
            </div>
            {todayMeetings.length === 0 ? (
              <p className="text-sm text-gray-600">No meetings today.</p>
            ) : todayMeetings.map(m => (
              <div key={m.id} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 mb-2 ${TYPE_COLORS[m.type]}`}>
                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-xs opacity-70">{m.time} · {m.duration}min</p>
                  {m.attendees.length > 0 && (
                    <p className="text-xs opacity-60 flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3" /> {m.attendees.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Upcoming</p>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-gray-600">No upcoming meetings.</p>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 group">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      m.type === 'review' ? 'bg-red-400' :
                      m.type === 'planning' ? 'bg-indigo-400' :
                      m.type === 'retro' ? 'bg-amber-400' : 'bg-green-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                      <p className="text-[10px] font-mono text-gray-600">{m.date} {m.time}</p>
                    </div>
                    {m.link && (
                      <a href={m.link} target="_blank" rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition rounded border border-white/10 p-1 text-gray-500 hover:text-white">
                        <Video className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowForm(true)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-white/10 py-2 text-xs font-semibold text-gray-400 hover:border-white/30 hover:text-white transition">
              <Plus className="h-3.5 w-3.5" /> Add Meeting
            </button>
          </div>

          {/* Legend */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Meeting Types</p>
            <div className="space-y-2">
              {[
                { type: 'review', label: 'Code Review' },
                { type: 'planning', label: 'Planning' },
                { type: 'retro', label: 'Retrospective' },
                { type: 'sync', label: 'Team Sync' },
              ].map(({ type, label }) => (
                <div key={type} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    type === 'review' ? 'bg-red-400' :
                    type === 'planning' ? 'bg-indigo-400' :
                    type === 'retro' ? 'bg-amber-400' : 'bg-green-400'
                  }`} />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
