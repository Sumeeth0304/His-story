'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { BibleStory, ERA_COLORS } from '@/data/bible-stories'

interface StoryNodeData extends Record<string, unknown> {
  story: BibleStory
  isSelected: boolean
}

function StoryNode({ data }: NodeProps) {
  const { story, isSelected } = data as StoryNodeData
  const [hovered, setHovered] = useState(false)

  const color = ERA_COLORS[story.era] ?? '#c4960a'
  const size = story.importance === 'major' ? 54 : 38
  const active = isSelected || hovered

  const glowSpread = isSelected ? 28 : hovered ? 20 : 10
  const glowOuter  = isSelected ? 50 : hovered ? 36 : 20

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Invisible handles for edge routing */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />

      {/* The floating circle — animation is on THIS element, not the RF wrapper */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          cursor: 'pointer',
          background: `radial-gradient(circle at 38% 35%, ${color}ee, ${color}88)`,
          border: `2px solid ${active ? '#fff' : color}cc`,
          boxShadow: [
            `0 0 ${glowSpread}px ${color}`,
            `0 0 ${glowOuter}px ${color}66`,
            isSelected ? `0 0 60px ${color}44` : '',
          ].filter(Boolean).join(', '),
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        }}
      />

      {/* Hover / selected tooltip */}
      {active && (
        <div
          style={{
            position: 'absolute',
            bottom: `calc(100% + 10px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'rgba(10,7,2,0.96)',
            border: `1px solid ${color}`,
            borderRadius: 8,
            padding: '7px 12px',
            whiteSpace: 'nowrap',
            boxShadow: `0 0 16px ${color}60, 0 4px 24px rgba(0,0,0,0.7)`,
            fontFamily: "'EB Garamond', Georgia, serif",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0d8a0', lineHeight: 1.2 }}>
            {story.title}
          </div>
          <div style={{ fontSize: 10, color: color, marginTop: 3, fontWeight: 600, letterSpacing: '0.04em' }}>
            {story.era}
          </div>
          <div style={{ fontSize: 10, color: '#8a6a30', marginTop: 2, fontStyle: 'italic' }}>
            {story.scripture}
          </div>
          {/* Arrow pointing down */}
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${color}`,
            }}
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />
    </div>
  )
}

export default memo(StoryNode)
