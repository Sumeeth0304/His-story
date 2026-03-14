'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'

const DeepDiveGraph = dynamic(
  () => import('@/components/DeepDiveGraph'),
  { ssr: false },
)

export default function DeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <DeepDiveGraph storyId={id} />
}
