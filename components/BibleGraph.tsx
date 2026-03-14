'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bibleStories, BibleStory, ERA_COLORS, ERA_ORDER } from '@/data/bible-stories'
import StoryList from './StoryList'
import StoryPanel from './StoryPanel'

type View = 'interconnect' | 'sequential'

// ── Interconnect nodes — module-level so positions survive view switches ──
// d3-force mutates these objects in-place (adds x, y, vx, vy).
// Reusing the same objects means the graph resumes exactly where it was.
const INTERCONNECT_NODES = bibleStories.map((s) => ({ id: s.id, story: s }))

// ── Link id pairs — stored as plain string tuples so d3-force never mutates them.
// d3-force replaces link.source / link.target with node object references in-place,
// which corrupts any array passed directly to the simulation. We keep these tuples
// pristine and generate fresh {source, target} objects each time.
const INTERCONNECT_LINK_PAIRS: [string, string][] = (() => {
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  bibleStories.forEach((s) => {
    s.connections.forEach((targetId) => {
      const key = [s.id, targetId].sort().join('--')
      if (!seen.has(key)) { seen.add(key); pairs.push([s.id, targetId]) }
    })
  })
  return pairs
})()

const SEQUENTIAL_LINK_PAIRS: [string, string][] = (() => {
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  const add = (a: string, b: string) => {
    const key = [a, b].sort().join('--')
    if (!seen.has(key)) { seen.add(key); pairs.push([a, b]) }
  }
  ERA_ORDER.forEach((era, ei) => {
    const stories = bibleStories.filter((s) => s.era === era)
    stories.forEach((s, i) => { if (i > 0) add(stories[i - 1].id, s.id) })
    if (ei < ERA_ORDER.length - 1) {
      const next = bibleStories.filter((s) => s.era === ERA_ORDER[ei + 1])
      if (stories.length && next.length) add(stories[stories.length - 1].id, next[0].id)
    }
  })
  return pairs
})()

// Always call these to get fresh link objects for each graphData update
const freshILinks = () => INTERCONNECT_LINK_PAIRS.map(([s, t]) => ({ source: s, target: t }))
const freshSLinks = () => SEQUENTIAL_LINK_PAIRS.map(([s, t]) => ({ source: s, target: t }))

// ── Sequential view layout data ──────────────────────────────
const STORIES_IN_ORDER = ERA_ORDER.flatMap((era) =>
  bibleStories.filter((s) => s.era === era)
)
const N = STORIES_IN_ORDER.length

// Heart curve: parametric equations scaled to match line width
const HEART_SCALE = 75
const H_SPACING   = 95

const HEART_TARGET: Record<string, { x: number; y: number }> = {}
const H_TARGET_X:   Record<string, number> = {}

STORIES_IN_ORDER.forEach((s, i) => {
  // Distribute evenly around the heart perimeter
  const t = (i / N) * 2 * Math.PI
  HEART_TARGET[s.id] = {
    x:  16 * Math.pow(Math.sin(t), 3) * HEART_SCALE,
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * HEART_SCALE,
  }
  // Final horizontal position (chronological left → right)
  H_TARGET_X[s.id] = (i - (N - 1) / 2) * H_SPACING
})

const HEART_HOLD   = 2000   // ms to hold the heart shape
const MORPH_DURATION = 2800 // ms to morph into the line

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const lerp       = (a: number, b: number, t: number) => a + (b - a) * t

const BTN_ID = '__deep-dive__'

// ── Cloud button painter ─────────────────────────────────────
function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  isHovered: boolean,
  globalScale: number,
) {
  const S    = 1 / globalScale
  const fill = isHovered ? 'rgba(240,210,80,0.97)' : 'rgba(210,165,20,0.90)'
  const glow = isHovered ? 'rgba(240,210,80,0.40)' : 'rgba(210,165,20,0.20)'

  const halo = [
    { dx: -12 * S, dy:  3 * S, r: 18 * S },
    { dx:  -3 * S, dy: -6 * S, r: 15 * S },
    { dx:   8 * S, dy: -7 * S, r: 17 * S },
    { dx:  17 * S, dy:  1 * S, r: 15 * S },
    { dx:   3 * S, dy:  5 * S, r: 14 * S },
  ]
  ctx.fillStyle = glow
  halo.forEach(({ dx, dy, r }) => {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 1.6, 0, 2 * Math.PI); ctx.fill()
  })

  const bumps = [
    { dx: -12 * S, dy:  3 * S, r: 13 * S },
    { dx:  -3 * S, dy: -5 * S, r: 11 * S },
    { dx:   8 * S, dy: -6 * S, r: 13 * S },
    { dx:  17 * S, dy:  1 * S, r: 11 * S },
    { dx:   3 * S, dy:  5 * S, r: 12 * S },
  ]
  ctx.fillStyle = fill
  bumps.forEach(({ dx, dy, r }) => {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 2 * Math.PI); ctx.fill()
  })

  const fs = Math.max(8 * S, 1)
  ctx.font = `700 ${fs}px 'EB Garamond', Georgia, serif`
  ctx.fillStyle = '#0d0a06'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Deep Dive', x + 3 * S, y)
}

// ── BibleGraph ───────────────────────────────────────────────
export default function BibleGraph() {
  const router = useRouter()

  const [view,          setView         ] = useState<View>('interconnect')
  const [selectedStory, setSelectedStory] = useState<BibleStory | null>(null)
  const [ForceGraph,    setForceGraph   ] = useState<any>(null)
  const [graphData,     setGraphData    ] = useState<any>({
    nodes: INTERCONNECT_NODES,
    links: freshILinks(),
  })
  const [isMobile, setIsMobile] = useState(false)
  const [showList, setShowList] = useState(false)

  const selectedRef  = useRef<BibleStory | null>(null)
  const hoveredRef   = useRef<string     | null>(null)
  const fgRef        = useRef<any>(null)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)
  const viewRef      = useRef<View>('interconnect')
  const viewNodesRef = useRef<any[]>(INTERCONNECT_NODES)

  useEffect(() => {
    import('react-force-graph-2d').then((mod) => setForceGraph(() => mod.default))
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Switch view ──────────────────────────────────────────
  const switchView = useCallback((next: View) => {
    selectedRef.current = null
    setSelectedStory(null)
    viewRef.current = next

    let nodes: any[]
    if (next === 'sequential') {
      // Fresh positions each time so the heart animation replays
      nodes = STORIES_IN_ORDER.map((s) => ({
        id: s.id, story: s,
        x: HEART_TARGET[s.id].x,
        y: HEART_TARGET[s.id].y,
        vx: 0, vy: 0,
      }))
      setGraphData({ nodes, links: freshSLinks() })
    } else {
      // Reuse the persistent objects — they already have x/y from the last session
      nodes = INTERCONNECT_NODES
      setGraphData({ nodes, links: freshILinks() })
    }

    // Keep a ref to these live node objects — the force graph will
    // mutate their x/y in-place, so this ref always has current positions
    viewNodesRef.current = nodes
    setView(next)  // triggers ForceGraph remount via key={view}
  }, [])

  // ── Heart → line morphing force ──────────────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    if (view === 'sequential') {
      const startTime = Date.now()
      let nodes: any[] = []

      const seqForce = (alpha: number) => {
        const elapsed  = Date.now() - startTime
        const progress = Math.max(0, Math.min(1, (elapsed - HEART_HOLD) / MORPH_DURATION))
        const t        = smoothstep(progress)  // eased 0 → 1

        nodes.forEach((n) => {
          if (n.id === BTN_ID || n.fx !== undefined) return
          const heart = HEART_TARGET[n.id]
          if (!heart) return

          // Interpolate target from heart → horizontal line
          const tx = lerp(heart.x, H_TARGET_X[n.id] ?? 0, t)
          const ty = lerp(heart.y, 0, t)

          // Stronger pull during morph, gentler once settled on line
          const strength = progress < 1 ? 0.12 : 0.06
          n.vx += (tx - (n.x ?? 0)) * strength * alpha
          n.vy += (ty - (n.y ?? 0)) * strength * alpha
        })
      }
      seqForce.initialize = (ns: any[]) => { nodes = ns }

      fg.d3Force('seq', seqForce)
      fg.d3ReheatSimulation?.()

      // Fit heart into view immediately
      setTimeout(() => fg.zoomToFit?.(600, 60), 200)
      // Re-fit once nodes have settled onto the line
      setTimeout(() => fg.zoomToFit?.(800, 60), HEART_HOLD + MORPH_DURATION + 400)
    } else {
      fg.d3Force('seq', null)
      fg.d3ReheatSimulation?.()
    }
  }, [view])

  // ── Select / deselect story ──────────────────────────────
  const selectStory = useCallback((story: BibleStory | null, nx = 0, ny = 0) => {
    selectedRef.current = story
    setSelectedStory(story)

    const baseLinks = viewRef.current === 'sequential' ? freshSLinks() : freshILinks()
    // viewNodesRef.current always points to the live node objects with current x/y
    const baseNodes = viewNodesRef.current

    if (!story) {
      setGraphData({ nodes: baseNodes, links: baseLinks })
      return
    }

    const buttonNode = {
      id: BTN_ID, story: null, isButton: true,
      x: nx + 40, y: ny + 70, vx: 0.5, vy: 0.8,
    }

    setGraphData({
      nodes: [...baseNodes, buttonNode],
      links: [...baseLinks, { source: story.id, target: BTN_ID }],
    })
  }, [])

  // ── Node click (single = select, double = unpin) ────────
  const handleNodeClick = useCallback((node: any) => {
    if (node.id === BTN_ID) {
      if (selectedRef.current) router.push(`/deep-dive/${selectedRef.current.id}`)
      return
    }

    const now = Date.now()
    const last = lastClickRef.current
    if (last && last.id === node.id && now - last.time < 350) {
      // Double-click → release the pin, let physics take over again
      node.fx = undefined
      node.fy = undefined
      lastClickRef.current = null
      fgRef.current?.d3ReheatSimulation?.()
      return
    }
    lastClickRef.current = { id: node.id, time: now }
    selectStory((node as any).story as BibleStory, node.x ?? 0, node.y ?? 0)
  }, [router, selectStory])

  // ── Node drag end → pin the node where user dropped it ──
  const handleNodeDragEnd = useCallback((node: any, translate: { dx: number; dy: number }) => {
    if (node.id === BTN_ID) return
    // Only pin if the user actually dragged (not just clicked)
    if (Math.abs(translate.dx) > 1 || Math.abs(translate.dy) > 1) {
      node.fx = node.x
      node.fy = node.y
    }
  }, [])

  const handleNodeHover = useCallback((node: any) => {
    hoveredRef.current = node ? node.id : null
    document.body.style.cursor = node ? 'pointer' : 'default'
  }, [])

  // ── Canvas: paint node ───────────────────────────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (node.id === BTN_ID) {
      drawCloud(ctx, node.x ?? 0, node.y ?? 0, hoveredRef.current === BTN_ID, globalScale)
      return
    }

    const story  = node.story as BibleStory
    const color  = ERA_COLORS[story.era] ?? '#c4960a'
    const radius = story.importance === 'major' ? 9 : 6
    const x      = node.x ?? 0
    const y      = node.y ?? 0

    const isSelected = selectedRef.current?.id === node.id
    const isHovered  = hoveredRef.current === node.id
    const active     = isSelected || isHovered

    const glowR = radius * (active ? 5 : 3)
    const glow  = ctx.createRadialGradient(x, y, 0, x, y, glowR)
    glow.addColorStop(0, color + (active ? 'bb' : '55'))
    glow.addColorStop(1, 'transparent')
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, 2 * Math.PI)
    ctx.fillStyle = glow; ctx.fill()

    const body = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
    body.addColorStop(0, color + 'ff')
    body.addColorStop(1, color + '99')
    ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = body; ctx.fill()

    ctx.strokeStyle = active ? '#ffffff' : color + 'cc'
    ctx.lineWidth   = (active ? 2 : 1) / globalScale
    ctx.stroke()

    if (active) {
      const label   = story.title
      const sub     = `${story.era}  ·  ${story.scripture}`
      const fs      = Math.max(14 / globalScale, 2)
      const fsSmall = fs * 0.72

      ctx.font = `700 ${fs}px 'EB Garamond', Georgia, serif`
      const w1 = ctx.measureText(label).width
      ctx.font = `${fsSmall}px 'EB Garamond', Georgia, serif`
      const w2 = ctx.measureText(sub).width

      const boxW = Math.max(w1, w2) + 12 / globalScale
      const boxH = fs + fsSmall + 14 / globalScale
      const boxX = x - boxW / 2
      const boxY = y - radius - boxH - 8 / globalScale

      ctx.fillStyle = 'rgba(10,7,2,0.93)'
      ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 6 / globalScale); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = 1 / globalScale; ctx.stroke()

      ctx.font = `700 ${fs}px 'EB Garamond', Georgia, serif`
      ctx.fillStyle = '#f0d8a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(label, x, boxY + 5 / globalScale)
      ctx.font = `${fsSmall}px 'EB Garamond', Georgia, serif`
      ctx.fillStyle = color
      ctx.fillText(sub, x, boxY + 5 / globalScale + fs + 2 / globalScale)

      const arrowY = y - radius - 6 / globalScale
      ctx.beginPath()
      ctx.moveTo(x - 5 / globalScale, arrowY)
      ctx.lineTo(x + 5 / globalScale, arrowY)
      ctx.lineTo(x, y - radius - 1 / globalScale)
      ctx.closePath(); ctx.fillStyle = color; ctx.fill()
    }
  }, [])

  // ── Canvas: hit area ─────────────────────────────────────
  const paintNodePointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (node.id === BTN_ID) {
      const S = 1 / globalScale
      ctx.beginPath()
      ctx.ellipse(node.x + 3 * S, node.y, 32 * S, 22 * S, 0, 0, 2 * Math.PI)
      ctx.fillStyle = color; ctx.fill()
      return
    }
    const radius = node.story?.importance === 'major' ? 9 : 6
    ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI)
    ctx.fillStyle = color; ctx.fill()
  }, [])

  // ── Link styling ─────────────────────────────────────────
  const linkColor = useCallback((link: any) => {
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    return tgt === BTN_ID ? 'rgba(240,210,80,0.55)' : 'rgba(196,150,10,0.35)'
  }, [])

  const linkWidth = useCallback((link: any) => {
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    return tgt === BTN_ID ? 1.5 : 1
  }, [])

  const linkDash = useCallback((link: any) => {
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    return tgt === BTN_ID ? [5, 4] : null
  }, [])

  // ── View toggle button styles ────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 18px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'EB Garamond', Georgia, serif",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1px solid rgba(196,150,10,0.4)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: active ? 'rgba(196,150,10,0.25)' : 'transparent',
    color:      active ? '#e8c870'               : 'rgba(196,150,10,0.5)',
    boxShadow:  active ? '0 0 12px rgba(196,150,10,0.2)' : 'none',
  })

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0d0a06' }}>

      {/* ── Header + view toggle ──────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'rgba(8,5,2,0.88)',
        border: '1px solid rgba(196,150,10,0.35)',
        borderTop: 'none', borderRadius: '0 0 16px 16px',
        backdropFilter: 'blur(10px)',
        textAlign: 'center', pointerEvents: 'auto',
        padding: isMobile ? '8px 16px 10px' : '10px 32px 12px',
        width: isMobile ? 'calc(100vw - 32px)' : 'auto',
      }}>
        <h1 style={{
          margin: '0 0 6px', fontSize: isMobile ? 20 : 26, fontWeight: 700,
          color: '#e8c870', letterSpacing: '0.12em',
          textShadow: '0 0 20px rgba(232,184,48,0.5)',
          pointerEvents: 'none',
        }}>
          His-story
        </h1>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 0, justifyContent: 'center', marginBottom: isMobile ? 0 : 6 }}>
          <button
            onClick={() => switchView('interconnect')}
            style={{ ...tabStyle(view === 'interconnect'), borderRadius: '6px 0 0 6px', fontSize: isMobile ? 9 : 11 }}
          >
            Interconnect
          </button>
          <button
            onClick={() => switchView('sequential')}
            style={{ ...tabStyle(view === 'sequential'), borderRadius: '0 6px 6px 0', borderLeft: 'none', fontSize: isMobile ? 9 : 11 }}
          >
            Sequential
          </button>
        </div>
        {!isMobile && (
          <div style={{ fontSize: 9.5, color: 'rgba(196,150,10,0.4)', marginTop: 5, fontStyle: 'italic', pointerEvents: 'none' }}>
            drag to pin · double-click to release
          </div>
        )}
      </div>

      {/* Mobile: hamburger toggle for story list */}
      {isMobile && (
        <button
          onClick={() => setShowList((v) => !v)}
          style={{
            position: 'fixed',
            top: 14,
            left: 12,
            zIndex: 60,
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(8,5,2,0.90)',
            border: '1px solid rgba(196,150,10,0.45)',
            color: '#c4960a',
            fontSize: showList ? 16 : 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 12px rgba(0,0,0,0.6)',
          }}
        >
          {showList ? '✕' : '☰'}
        </button>
      )}

      {/* Mobile: backdrop to close list */}
      {isMobile && showList && (
        <div
          onClick={() => setShowList(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.45)' }}
        />
      )}

      {/* Sidebar: always on desktop, toggled on mobile */}
      {(!isMobile || showList) && (
        <StoryList
          stories={bibleStories}
          selectedId={selectedStory?.id ?? null}
          onSelect={(story) => {
            selectStory(story)
            if (isMobile) setShowList(false)
          }}
        />
      )}

      <div style={{ marginLeft: isMobile ? 0 : 220, flex: 1, height: '100%' }}>
        {ForceGraph && (
          <ForceGraph
            key={view}
            ref={fgRef}
            graphData={graphData}
            backgroundColor="#0d0a06"
            d3VelocityDecay={0.25}
            d3AlphaDecay={0.008}
            warmupTicks={0}
            cooldownTicks={Infinity}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={paintNodePointer}
            nodeRelSize={6}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkLineDash={linkDash}
            onNodeClick={handleNodeClick}
            onNodeDragEnd={handleNodeDragEnd}
            onNodeHover={handleNodeHover}
            onBackgroundClick={() => selectStory(null)}
          />
        )}
      </div>

      <StoryPanel story={selectedStory} onClose={() => selectStory(null)} isMobile={isMobile} />
    </div>
  )
}
