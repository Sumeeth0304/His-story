'use client'

import { BibleStory, ERA_COLORS, ERA_ORDER } from '@/data/bible-stories'

interface StoryListProps {
  stories: BibleStory[]
  selectedId: string | null
  onSelect: (story: BibleStory) => void
}

export default function StoryList({ stories, selectedId, onSelect }: StoryListProps) {
  const byEra = ERA_ORDER.reduce<Record<string, BibleStory[]>>((acc, era) => {
    acc[era] = stories.filter((s) => s.era === era)
    return acc
  }, {})

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 220,
        height: '100vh',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(8,5,2,0.95)',
        borderRight: '1px solid rgba(196,150,10,0.2)',
        backdropFilter: 'blur(12px)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
        fontFamily: "'EB Garamond', Georgia, serif",
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 14px 12px',
          borderBottom: '1px solid rgba(196,150,10,0.2)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#c4960a',
            textShadow: '0 0 8px rgba(196,150,10,0.5)',
          }}
        >
          ✦ Bible Stories
        </div>
        <div style={{ fontSize: 10, color: '#5a4820', marginTop: 3 }}>
          {stories.length} stories · click to explore
        </div>
      </div>

      {/* Story list grouped by era */}
      <div style={{ flex: 1, padding: '8px 0 20px' }}>
        {ERA_ORDER.map((era) => {
          const eraStories = byEra[era] ?? []
          const eraColor = ERA_COLORS[era]
          return (
            <div key={era} style={{ marginBottom: 4 }}>
              {/* Era header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px 5px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: eraColor,
                    boxShadow: `0 0 8px ${eraColor}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: eraColor,
                  }}
                >
                  {era}
                </span>
              </div>

              {/* Stories in this era */}
              {eraStories.map((story) => {
                const isSelected = story.id === selectedId
                return (
                  <button
                    key={story.id}
                    onClick={() => onSelect(story)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      padding: '5px 14px 5px 24px',
                      background: isSelected ? `${eraColor}18` : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? `2px solid ${eraColor}` : '2px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontFamily: "'EB Garamond', Georgia, serif",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = `${eraColor}10`
                        e.currentTarget.style.borderLeftColor = `${eraColor}60`
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderLeftColor = 'transparent'
                      }
                    }}
                  >
                    {/* Dot */}
                    <span
                      style={{
                        display: 'inline-block',
                        width: story.importance === 'major' ? 9 : 6,
                        height: story.importance === 'major' ? 9 : 6,
                        borderRadius: '50%',
                        background: eraColor,
                        boxShadow: isSelected ? `0 0 8px ${eraColor}` : `0 0 4px ${eraColor}80`,
                        flexShrink: 0,
                      }}
                    />
                    {/* Name */}
                    <span
                      style={{
                        fontSize: 11.5,
                        color: isSelected ? '#f0d8a0' : '#8a7040',
                        lineHeight: 1.3,
                        fontWeight: isSelected || story.importance === 'major' ? 600 : 400,
                        transition: 'color 0.15s',
                      }}
                    >
                      {story.title}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
