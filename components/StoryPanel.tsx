'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { BibleStory } from '@/data/bible-stories'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface StoryPanelProps {
  story: BibleStory | null
  onClose: () => void
  isMobile?: boolean
}

const ERA_ACCENT: Record<string, string> = {
  Creation:             '#c4860a',
  Patriarchs:           '#b86b12',
  Exodus:               '#a05a1a',
  'Conquest & Judges':  '#7a6b2a',
  Kingdom:              '#6b5030',
  'Prophets & Exile':   '#4a5570',
  'New Testament':      '#2a6b5a',
}

export default function StoryPanel({ story, onClose, isMobile = false }: StoryPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [panelHeight, setPanelHeight] = useState(72) // vh, mobile only
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevStoryId = useRef<string | null>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    if (story && story.id !== prevStoryId.current) {
      setMessages([])
      setInput('')
      setPanelHeight(72)
      prevStoryId.current = story.id
    }
  }, [story])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (story) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [story])

  const handleDragStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, startH: panelHeight }
  }

  const handleDragMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    const newH = dragRef.current.startH - (dy / window.innerHeight) * 100
    setPanelHeight(Math.max(18, Math.min(92, newH)))
  }

  const handleDragEnd = () => {
    if (!dragRef.current) return
    dragRef.current = null
    if (panelHeight < 28) {
      onClose()
      setPanelHeight(72)
    } else if (panelHeight < 52) {
      setPanelHeight(40)
    } else {
      setPanelHeight(72)
    }
  }

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

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

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
              const parsed = JSON.parse(data)
              const text = parsed.delta?.text ?? ''
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
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, story, loading, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const accent = story ? ERA_ACCENT[story.era] ?? '#c4960a' : '#c4960a'
  const isOpen = story !== null

  const panelStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    height: `${panelHeight}vh`,
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'EB Garamond', Georgia, serif",
    background: 'rgba(10,7,2,0.97)',
    borderTop: `2px solid ${accent}60`,
    borderRadius: '16px 16px 0 0',
    boxShadow: `0 -8px 40px rgba(0,0,0,0.8)`,
    backdropFilter: 'blur(16px)',
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  } : {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100%',
    width: 400,
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'EB Garamond', Georgia, serif",
    background: 'rgba(10,7,2,0.95)',
    borderLeft: `1px solid ${accent}60`,
    boxShadow: `-8px 0 40px rgba(0,0,0,0.7), inset 0 0 80px rgba(196,150,10,0.03)`,
    backdropFilter: 'blur(16px)',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  return (
    <div style={panelStyle}>
      {/* Drag handle — mobile only */}
      {isMobile && (
        <div
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0, cursor: 'ns-resize', touchAction: 'none' }}
        >
          <div style={{ width: 40, height: 5, borderRadius: 3, background: `${accent}60` }} />
        </div>
      )}
      {story && (
        <>
          {/* Header */}
          <div
            style={{
              padding: '18px 20px 14px',
              borderBottom: `1px solid ${accent}40`,
              flexShrink: 0,
              background: `linear-gradient(135deg, rgba(13,10,6,0.9) 0%, rgba(26,18,6,0.8) 100%)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: accent,
                    marginBottom: 6,
                    textShadow: `0 0 8px ${accent}`,
                  }}
                >
                  {story.era} · {story.period}
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#f0d8a0',
                    margin: 0,
                    lineHeight: 1.2,
                    textShadow: `0 0 12px rgba(212,168,83,0.2)`,
                  }}
                >
                  {story.title}
                </h2>
                <div
                  style={{
                    fontSize: 11,
                    fontStyle: 'italic',
                    color: '#8a6a30',
                    marginTop: 4,
                  }}
                >
                  {story.scripture}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7a6030',
                  background: 'transparent',
                  border: `1px solid ${accent}30`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f0d8a0'
                  e.currentTarget.style.borderColor = `${accent}80`
                  e.currentTarget.style.background = `${accent}20`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#7a6030'
                  e.currentTarget.style.borderColor = `${accent}30`
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Story summary */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${accent}20`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: accent,
                marginBottom: 10,
              }}
            >
              ✦ The Story
            </div>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.7,
                color: '#c8a870',
                margin: 0,
              }}
            >
              {story.summary}
            </p>
          </div>

          {/* Chat section */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Chat header */}
            <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: accent,
                  }}
                >
                  ✦ Ask a Scholar
                </span>
                <span style={{ fontSize: 10, color: '#5a4820', fontStyle: 'italic' }}>
                  powered by Claude AI
                </span>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 20px 8px',
                minHeight: 0,
              }}
            >
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>✦</div>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#6a5020',
                      fontStyle: 'italic',
                      lineHeight: 1.6,
                      marginBottom: 16,
                    }}
                  >
                    Ask anything about {story.title} — themes, history, theology, characters, or connections.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      `What is the main theme of ${story.title}?`,
                      'What does this story teach us?',
                      'How does this connect to the rest of the Bible?',
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); inputRef.current?.focus() }}
                        style={{
                          fontSize: 11,
                          color: '#a08040',
                          background: 'rgba(196,150,10,0.08)',
                          border: `1px solid ${accent}30`,
                          borderRadius: 6,
                          padding: '7px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: "'EB Garamond', Georgia, serif",
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${accent}20`
                          e.currentTarget.style.borderColor = `${accent}60`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(196,150,10,0.08)'
                          e.currentTarget.style.borderColor = `${accent}30`
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      ...(msg.role === 'user'
                        ? {
                            background: `${accent}cc`,
                            color: '#f5e6c8',
                            boxShadow: `0 0 12px ${accent}60`,
                          }
                        : {
                            background: 'rgba(196,150,10,0.08)',
                            color: '#c8a870',
                            border: `1px solid ${accent}25`,
                          }),
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: accent,
                          marginBottom: 4,
                        }}
                      >
                        Scholar
                      </div>
                    )}
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    {msg.role === 'assistant' && msg.content === '' && loading && (
                      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            style={{
                              display: 'inline-block',
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: accent,
                              animation: `bounce 1s ease-in-out ${delay}ms infinite`,
                            }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: `1px solid ${accent}25`,
                flexShrink: 0,
                background: 'rgba(13,10,6,0.8)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this story..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: 'rgba(26,18,6,0.8)',
                    border: `1px solid ${accent}35`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#d4b870',
                    fontFamily: "'EB Garamond', Georgia, serif",
                    outline: 'none',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = `${accent}80` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = `${accent}35` }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  style={{
                    flexShrink: 0,
                    background: !input.trim() || loading ? 'rgba(196,150,10,0.2)' : accent,
                    color: !input.trim() || loading ? '#5a4820' : '#f5e6c8',
                    border: `1px solid ${accent}50`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'EB Garamond', Georgia, serif",
                    cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: !input.trim() || loading ? 'none' : `0 0 12px ${accent}60`,
                  }}
                >
                  Ask ✦
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bounce keyframes via style tag */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
