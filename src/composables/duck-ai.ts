import { useDB } from '@/db.ts'

export const models = {
  'GPT-4o mini': 'gpt-4o-mini',
  'Claude 3 Haiku': 'claude-3-haiku-20240307',
  'Llama 3.1 70B': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'Mixtral 8x7B': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
} as const

export type DuckModel = typeof models[keyof typeof models]

export const getModelByCode = (value: string) => {
  return Object.entries(models).find(([_, val]) => val === value)
    ?.[0]
}

interface DuckAiOptions {
  model?: DuckModel
  chatId: number
}

const db = await useDB()

export const useDuckAi = (options: DuckAiOptions) => {
  db?.setChatId(options.chatId)

  const STATUS_URL = 'https://duckduckgo.com/duckchat/v1/status'
  const CHAT_URL = 'https://duckduckgo.com/duckchat/v1/chat'

  const getVqd = async (): Promise<string> => {
    const savedVqd = await db?.getVqd()
    if (savedVqd) return savedVqd

    const status = await fetch(STATUS_URL, {
      headers: { 'x-vqd-accept': '1' },
    })

    const vqd = status.headers.get('x-vqd-4')
    if (!vqd) {
      throw new Error(
        'Unable to retrieve the vqd from the duck.ai response. This is required for authentication.',
      )
    }

    return vqd
  }

  const chat = async (content: string) => {
    const savedMessage = await db?.getMessages() || []

    const data = {
      model: options.model ?? 'gpt-4o-mini',
      messages: savedMessage?.concat({
        role: 'user',
        content,
      }),
    }

    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vqd-4': await getVqd(),
      },
      body: JSON.stringify(data),
    })

    if (!res.body) {
      throw new Error(
        `Failed to fetch duck.ai response: ${res.status} ${res.statusText}`,
      )
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true }).replace(
          /data: /g,
          '',
        )

        const parts = chunk.split('\n')

        for (const part of parts) {
          if (part && part !== '[DONE]') {
            try {
              const parsed = JSON.parse(part.trim())
              if (parsed.message) {
                result += parsed.message
              }
            } catch {
              // Silently ignore parsing errors for individual parts
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing stream:', error)
    }

    const vqd = res.headers.get('x-vqd-4')

    if (!vqd) {
      throw new Error(
        'Failed to retrieve VQD (x-vqd-4) from response headers for future requests',
      )
    }

    if (!result) {
      throw new Error('No result obtained from the AI response stream')
    }

    await Promise.all([
      db?.saveMessages([
        {
          role: 'user',
          content,
        },
        {
          role: 'assistant',
          content: result,
        },
      ]),
      db?.saveVqd(vqd),
    ])

    return {
      message: result,
      vqd,
    }
  }

  return {
    chat,
  }
}
