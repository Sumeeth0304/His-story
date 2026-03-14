'use client'

import dynamic from 'next/dynamic'

// React Flow requires browser APIs — load client-side only
const BibleGraph = dynamic(() => import('@/components/BibleGraph'), { ssr: false })

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <BibleGraph />
    </main>
  )
}
