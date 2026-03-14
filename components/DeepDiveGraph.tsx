'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { bibleStories, BibleStory, ERA_COLORS, connLabel } from '@/data/bible-stories'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  storyId: string
}

// Split a title into lines that fit within maxChars
function splitLines(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export default function DeepDiveGraph({ storyId }: Props) {
  const router = useRouter()

  // Declare story first so hooks below can reference it
  const story = useMemo(() => bibleStories.find((s) => s.id === storyId), [storyId])

  const [hoveredId,   setHoveredId  ] = useState<string | null>(null)
  const [clickedEdge, setClickedEdge] = useState<string | null>(null)
  const [messages,    setMessages   ] = useState<Message[]>([])
  const [input,       setInput      ] = useState('')
  const [loading,     setLoading    ] = useState(false)
  const [isMobile,    setIsMobile   ] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [storyId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !story || loading) return
    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyTitle: story.title,
          storyContext: `${story.title} (${story.scripture}, ${story.period}): ${story.summary}`,
          userMessage,
          history: messages,
        }),
      })
      if (!response.ok) throw new Error('Failed')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No body')
      let assistantMessage = ''
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const text = JSON.parse(data).delta?.text ?? ''
              if (text) {
                assistantMessage += text
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage }
                  return updated
                })
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [input, story, loading, messages])

  const handleKeyDown = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const connected = useMemo(() => {
    if (!story) return []
    return story.connections
      .map((id) => bibleStories.find((s) => s.id === id))
      .filter(Boolean) as BibleStory[]
  }, [story])

  if (!story) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0d0a06',
        color: '#c4960a', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 18,
      }}>
        Story not found.&nbsp;
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push('/')}>
          ← Back to graph
        </span>
      </div>
    )
  }

  const n          = connected.length
  const RING_R     = Math.max(230, Math.min(340, n * 32))
  const VIEW       = RING_R + 130
  const centerColor = ERA_COLORS[story.era] ?? '#c4960a'

  const positions = connected.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2   // start at top
    return {
      x: RING_R * Math.cos(angle),
      y: RING_R * Math.sin(angle),
    }
  })

  // Panel always shows the center story — hover only affects SVG highlighting
  const focusColor = ERA_COLORS[story.era] ?? '#c4960a'

  // Only used for the "Deep Dive into X" button label when hovering a node
  const hoveredStory = hoveredId ? connected.find((s) => s.id === hoveredId) : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      width: '100vw',
      height: '100vh',
      background: '#0d0a06',
      fontFamily: "'EB Garamond', Georgia, serif",
      overflow: 'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, padding: isMobile ? '6px 16px' : '10px 36px',
        background: 'rgba(8,5,2,0.88)',
        border: '1px solid rgba(196,150,10,0.35)',
        borderTop: 'none', borderRadius: '0 0 14px 14px',
        backdropFilter: 'blur(10px)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <h1 style={{
          margin: 0, fontSize: isMobile ? 18 : 26, fontWeight: 700,
          color: '#e8c870', letterSpacing: '0.12em',
          textShadow: '0 0 20px rgba(232,184,48,0.5)',
        }}>
          His-story
        </h1>
      </div>

      {/* ── Navigation buttons ───────────────────────────── */}
      <div style={{ position: 'fixed', top: isMobile ? 10 : 20, left: isMobile ? 8 : 20, zIndex: 50, display: 'flex', gap: 6 }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(8,5,2,0.88)',
            border: '1px solid rgba(196,150,10,0.35)',
            borderRadius: 8, padding: isMobile ? '5px 10px' : '8px 16px',
            color: '#c4960a', cursor: 'pointer',
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: isMobile ? 11 : 14, backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,150,10,0.15)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(8,5,2,0.88)' }}
        >
          ← Graph
        </button>
        <button
          onClick={() => router.back()}
          style={{
            background: 'rgba(8,5,2,0.88)',
            border: '1px solid rgba(196,150,10,0.35)',
            borderRadius: 8, padding: isMobile ? '5px 10px' : '8px 16px',
            color: '#c4960a', cursor: 'pointer',
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: isMobile ? 11 : 14, backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,150,10,0.15)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(8,5,2,0.88)' }}
        >
          ← Previous
        </button>
      </div>

      {/* ── SVG Graph ───────────────────────────────────── */}
      <div style={{
        flex: isMobile ? 'none' : 1,
        height: isMobile ? '45vh' : '100%',
        paddingTop: isMobile ? 48 : 72,
        boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg
          viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
          style={{
            width: '100%', height: '100%',
            maxWidth: isMobile ? '100vw' : 'calc(100vh - 152px)',
            maxHeight: isMobile ? 'calc(45vh - 48px)' : 'calc(100vh - 152px)',
          }}
          onClick={() => setClickedEdge(null)}
        >
          <defs>
            <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Edges ─────────────────────────────────── */}
          {connected.map((conn, i) => {
            const pos        = positions[i]
            const isHovered  = hoveredId === conn.id
            const isClicked  = clickedEdge === conn.id
            const isActive   = isHovered || isClicked
            const edgeColor  = isActive ? (ERA_COLORS[conn.era] ?? '#c4960a') : 'rgba(196,150,10,0.28)'
            const label      = connLabel(story.id, conn.id)
            const mx         = pos.x / 2
            const my         = pos.y / 2

            return (
              <g key={conn.id}>
                {/* Invisible wide hit area so the thin line is easy to click */}
                <line
                  x1={0} y1={0} x2={pos.x} y2={pos.y}
                  stroke="transparent"
                  strokeWidth={18}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setClickedEdge(isClicked ? null : conn.id)
                  }}
                />
                {/* Visible line */}
                <line
                  x1={0} y1={0} x2={pos.x} y2={pos.y}
                  stroke={edgeColor}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? 'none' : '4 3'}
                  style={{ transition: 'stroke 0.25s, stroke-width 0.25s', pointerEvents: 'none' }}
                />
                {/* Label pill shown on click */}
                {isClicked && label && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={mx - 52} y={my - 12}
                      width={104} height={22}
                      rx={6}
                      fill="rgba(10,7,2,0.92)"
                      stroke={ERA_COLORS[conn.era] ?? '#c4960a'}
                      strokeWidth={1}
                    />
                    <text
                      x={mx} y={my + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={ERA_COLORS[conn.era] ?? '#c4960a'}
                      fontSize={9}
                      fontFamily="'EB Garamond', Georgia, serif"
                      fontWeight={700}
                      letterSpacing="0.06em"
                    >
                      {label.toUpperCase()}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* ── Surrounding nodes ─────────────────────── */}
          {connected.map((conn, i) => {
            const pos      = positions[i]
            const color    = ERA_COLORS[conn.era] ?? '#c4960a'
            const isActive = hoveredId === conn.id
            const r        = conn.importance === 'major' ? 38 : 30
            const lines    = splitLines(conn.title, 11)

            return (
              <g
                key={conn.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredId(conn.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => router.push(`/deep-dive/${conn.id}`)}
              >
                {/* Pulse ring */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r + (isActive ? 18 : 9)}
                  fill={color}
                  opacity={isActive ? 0.22 : 0.07}
                  style={{ transition: 'all 0.25s' }}
                />
                {/* Node body */}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={color}
                  opacity={isActive ? 1 : 0.72}
                  stroke={isActive ? '#ffffff' : color}
                  strokeWidth={isActive ? 2 : 1}
                  filter={isActive ? 'url(#glow-soft)' : undefined}
                  style={{ transition: 'all 0.25s' }}
                />
                {/* Title */}
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={pos.x}
                    y={pos.y + (li - (lines.length - 1) / 2) * 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isActive ? '#ffffff' : '#f0d8a0'}
                    fontSize={9.5}
                    fontFamily="'EB Garamond', Georgia, serif"
                    fontWeight={isActive ? 700 : 500}
                    style={{ transition: 'fill 0.25s', pointerEvents: 'none' }}
                  >
                    {line}
                  </text>
                ))}
                {/* Era label below node */}
                <text
                  x={pos.x}
                  y={pos.y + r + 13}
                  textAnchor="middle"
                  fill={color}
                  fontSize={7.5}
                  fontFamily="'EB Garamond', Georgia, serif"
                  opacity={isActive ? 1 : 0.6}
                  style={{ pointerEvents: 'none', letterSpacing: '0.06em' }}
                >
                  {conn.era.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* ── Center node ───────────────────────────── */}
          <g filter="url(#glow-strong)" style={{ pointerEvents: 'none' }}>
            <circle cx={0} cy={0} r={100} fill={centerColor} opacity={0.08} />
            <circle cx={0} cy={0} r={72}  fill={centerColor} opacity={0.14} />
            <circle cx={0} cy={0} r={56}  fill={centerColor} opacity={0.95}
              stroke="#ffffff" strokeWidth={2.5} />
          </g>

          {/* Center title */}
          {splitLines(story.title, 9).map((line, li, arr) => (
            <text
              key={li}
              x={0}
              y={(li - (arr.length - 1) / 2) * 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize={12}
              fontFamily="'EB Garamond', Georgia, serif"
              fontWeight={700}
              style={{ pointerEvents: 'none' }}
            >
              {line}
            </text>
          ))}

          {/* Center era label */}
          <text
            x={0}
            y={splitLines(story.title, 9).length * 8 + 18}
            textAnchor="middle"
            fill={centerColor}
            fontSize={8.5}
            fontFamily="'EB Garamond', Georgia, serif"
            style={{ pointerEvents: 'none', letterSpacing: '0.1em' }}
          >
            {story.era.toUpperCase()}
          </text>
        </svg>
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div style={{
        width: isMobile ? '100%' : 320,
        flexShrink: 0,
        height: isMobile ? '55vh' : '100%',
        background: 'rgba(8,5,2,0.95)',
        borderLeft: isMobile ? 'none' : '1px solid rgba(196,150,10,0.2)',
        borderTop: isMobile ? '1px solid rgba(196,150,10,0.2)' : 'none',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ── Story details (scrollable) ───────────────── */}
        <div style={{
          padding: isMobile ? '12px 16px 12px' : '80px 20px 16px',
          overflowY: 'auto',
          flexShrink: 0,
          maxHeight: '46%',
          borderBottom: '1px solid rgba(196,150,10,0.15)',
        }}>
          <div style={{
            display: 'inline-block', alignSelf: 'flex-start',
            padding: '3px 10px', borderRadius: 4,
            background: `${focusColor}18`,
            border: `1px solid ${focusColor}`,
            color: focusColor, fontSize: 10,
            fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 12,
            transition: 'all 0.25s',
          }}>
            {story.era}
          </div>

          <h2 style={{
            margin: '0 0 6px', fontSize: 20,
            color: '#f0d8a0', fontWeight: 700, lineHeight: 1.2,
            transition: 'all 0.25s',
          }}>
            {story.title}
          </h2>

          <div style={{ fontSize: 11, color: '#7a5a20', marginBottom: 3 }}>
            {story.period}
          </div>
          <div style={{ fontSize: 11, color: focusColor, fontStyle: 'italic', marginBottom: 12, transition: 'color 0.25s' }}>
            {story.scripture}
          </div>

          <p style={{ fontSize: 13, color: '#c8a870', lineHeight: 1.7, margin: '0 0 12px' }}>
            {story.summary}
          </p>

          {hoveredStory && (
            <button
              onClick={() => router.push(`/deep-dive/${hoveredStory.id}`)}
              style={{
                padding: '8px 14px',
                background: `${focusColor}18`,
                border: `1px solid ${focusColor}`,
                borderRadius: 8, color: focusColor,
                cursor: 'pointer',
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: 12, fontWeight: 600,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${focusColor}30` }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${focusColor}18` }}
            >
              Deep Dive into {hoveredStory.title} →
            </button>
          )}
        </div>

        {/* ── AI Scholar chat ───────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Chat header */}
          <div style={{ padding: '10px 20px 6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: centerColor,
              }}>
                ✦ Ask a Scholar
              </span>
              <span style={{ fontSize: 10, color: '#5a4820', fontStyle: 'italic' }}>
                about {story.title}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 8px', minHeight: 0 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.5 }}>✦</div>
                <p style={{
                  fontSize: 11, color: '#6a5020', fontStyle: 'italic',
                  lineHeight: 1.6, marginBottom: 12,
                }}>
                  Ask anything about {story.title} — its meaning, connections, or historical context.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    `Why is ${story.title} significant?`,
                    'How does this connect to the rest of the Bible?',
                    'What can we learn from this story?',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      style={{
                        fontSize: 11, color: '#a08040',
                        background: 'rgba(196,150,10,0.08)',
                        border: `1px solid ${centerColor}30`,
                        borderRadius: 6, padding: '6px 10px',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: "'EB Garamond', Georgia, serif",
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${centerColor}20`
                        e.currentTarget.style.borderColor = `${centerColor}60`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(196,150,10,0.08)'
                        e.currentTarget.style.borderColor = `${centerColor}30`
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}>
                <div style={{
                  maxWidth: '88%', borderRadius: 8,
                  padding: '7px 11px', fontSize: 12, lineHeight: 1.6,
                  ...(msg.role === 'user'
                    ? { background: `${centerColor}cc`, color: '#f5e6c8', boxShadow: `0 0 10px ${centerColor}60` }
                    : { background: 'rgba(196,150,10,0.08)', color: '#c8a870', border: `1px solid ${centerColor}25` }),
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: centerColor, marginBottom: 3,
                    }}>Scholar</div>
                  )}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  {msg.role === 'assistant' && msg.content === '' && loading && (
                    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} style={{
                          display: 'inline-block', width: 4, height: 4,
                          borderRadius: '50%', background: centerColor,
                          animation: `bounce 1s ease-in-out ${delay}ms infinite`,
                        }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 14px',
            borderTop: `1px solid ${centerColor}25`,
            flexShrink: 0,
            background: 'rgba(13,10,6,0.8)',
          }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this story..."
                disabled={loading}
                style={{
                  flex: 1, background: 'rgba(26,18,6,0.8)',
                  border: `1px solid ${centerColor}35`,
                  borderRadius: 8, padding: '7px 11px',
                  fontSize: 12, color: '#d4b870',
                  fontFamily: "'EB Garamond', Georgia, serif",
                  outline: 'none', opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${centerColor}80` }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = `${centerColor}35` }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  flexShrink: 0,
                  background: !input.trim() || loading ? 'rgba(196,150,10,0.2)' : centerColor,
                  color: !input.trim() || loading ? '#5a4820' : '#f5e6c8',
                  border: `1px solid ${centerColor}50`,
                  borderRadius: 8, padding: '7px 12px',
                  fontSize: 12, fontWeight: 700,
                  fontFamily: "'EB Garamond', Georgia, serif",
                  cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: !input.trim() || loading ? 'none' : `0 0 10px ${centerColor}60`,
                }}
              >
                Ask ✦
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); opacity: 0.4; }
            50%       { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}
