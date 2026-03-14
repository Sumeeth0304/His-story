'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { bibleStories, BibleStory, ERA_COLORS, connLabel } from '@/data/bible-stories'

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
  const [hoveredId,  setHoveredId ] = useState<string | null>(null)
  const [clickedEdge, setClickedEdge] = useState<string | null>(null)

  const story = useMemo(() => bibleStories.find((s) => s.id === storyId), [storyId])

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

  const focusedStory = hoveredId
    ? (connected.find((s) => s.id === hoveredId) ?? story)
    : story

  const focusColor = ERA_COLORS[focusedStory.era] ?? '#c4960a'

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: '#0d0a06',
      fontFamily: "'EB Garamond', Georgia, serif",
      overflow: 'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, padding: '10px 36px',
        background: 'rgba(8,5,2,0.88)',
        border: '1px solid rgba(196,150,10,0.35)',
        borderTop: 'none', borderRadius: '0 0 14px 14px',
        backdropFilter: 'blur(10px)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <h1 style={{
          margin: 0, fontSize: 26, fontWeight: 700,
          color: '#e8c870', letterSpacing: '0.12em',
          textShadow: '0 0 20px rgba(232,184,48,0.5)',
        }}>
          His-story
        </h1>
      </div>

      {/* ── Back button ─────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'fixed', top: 20, left: 20, zIndex: 50,
          background: 'rgba(8,5,2,0.88)',
          border: '1px solid rgba(196,150,10,0.35)',
          borderRadius: 8, padding: '8px 16px',
          color: '#c4960a', cursor: 'pointer',
          fontFamily: "'EB Garamond', Georgia, serif",
          fontSize: 14, backdropFilter: 'blur(10px)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,150,10,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(8,5,2,0.88)' }}
      >
        ← Back to Graph
      </button>

      {/* ── SVG Graph ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
          style={{
            width: '100%', height: '100%',
            maxWidth: 'calc(100vh - 80px)',
            maxHeight: 'calc(100vh - 80px)',
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

      {/* ── Right info panel ────────────────────────────── */}
      <div style={{
        width: 320, flexShrink: 0, height: '100%',
        background: 'rgba(8,5,2,0.95)',
        borderLeft: '1px solid rgba(196,150,10,0.2)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        padding: '80px 20px 20px',
        overflowY: 'auto',
        transition: 'all 0.25s',
      }}>
        {/* Era badge */}
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
          {focusedStory.era}
        </div>

        <h2 style={{
          margin: '0 0 6px', fontSize: 22,
          color: '#f0d8a0', fontWeight: 700, lineHeight: 1.2,
          transition: 'all 0.25s',
        }}>
          {focusedStory.title}
        </h2>

        <div style={{ fontSize: 12, color: '#7a5a20', marginBottom: 4 }}>
          {focusedStory.period}
        </div>
        <div style={{ fontSize: 12, color: focusColor, fontStyle: 'italic', marginBottom: 16, transition: 'color 0.25s' }}>
          {focusedStory.scripture}
        </div>

        <p style={{ fontSize: 14, color: '#c8a870', lineHeight: 1.75, margin: '0 0 20px' }}>
          {focusedStory.summary}
        </p>

        {/* Deep dive into hovered node */}
        {hoveredId && (
          <button
            onClick={() => router.push(`/deep-dive/${hoveredId}`)}
            style={{
              padding: '10px 16px',
              background: `${focusColor}18`,
              border: `1px solid ${focusColor}`,
              borderRadius: 8, color: focusColor,
              cursor: 'pointer',
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: 13, fontWeight: 600,
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${focusColor}30` }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${focusColor}18` }}
          >
            Deep Dive into {focusedStory.title} →
          </button>
        )}

        {/* Connections list */}
        <div style={{
          marginTop: 24,
          borderTop: '1px solid rgba(196,150,10,0.15)',
          paddingTop: 16,
        }}>
          <div style={{
            fontSize: 9, color: '#5a4820',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            {n} Connection{n !== 1 ? 's' : ''}
          </div>
          {connected.map((conn) => {
            const color    = ERA_COLORS[conn.era] ?? '#c4960a'
            const isActive = hoveredId === conn.id
            return (
              <div
                key={conn.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 0', cursor: 'pointer',
                  color: isActive ? '#f0d8a0' : '#6a5030',
                  fontSize: 12.5, transition: 'color 0.15s',
                }}
                onMouseEnter={() => setHoveredId(conn.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => router.push(`/deep-dive/${conn.id}`)}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, flexShrink: 0,
                  boxShadow: isActive ? `0 0 8px ${color}` : 'none',
                  transition: 'box-shadow 0.15s',
                }} />
                {conn.title}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
