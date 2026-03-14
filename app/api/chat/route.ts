import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { storyTitle, storyContext, userMessage, history } = await req.json()

  const systemPrompt = `You are a warm, knowledgeable biblical scholar helping people explore the Bible's stories. You are currently focused on: ${storyTitle}.

Context for this story:
${storyContext}

Guidelines:
- Answer questions about this specific story — its themes, characters, historical context, theological significance, and connections to the rest of the Bible
- Be warm, accessible, and engaging — you're talking to curious people, not seminary students
- Keep answers focused and conversational (2–4 paragraphs max unless the question demands more)
- When relevant, mention connections to other Bible stories or how this story fits the larger biblical narrative
- You may draw from both Old and New Testament perspectives when appropriate
- Be honest about things that are debated or uncertain among scholars
- Do not add disclaimers about being an AI — just be a helpful guide`

  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ delta: { text: event.delta.text } })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
