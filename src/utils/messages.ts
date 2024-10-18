import { monotonicUlid } from '@std/ulid'

interface MessageOptions {
  chatId: number
  kv: Deno.Kv
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const useMessages = (options: MessageOptions) => {
  const kv = options.kv

  const getAll = async () => {
    const entries = kv.list<Message>({
      prefix: ['messages', options.chatId],
    })

    return await Array.fromAsync(entries, (entry) => entry.value)
  }

  const save = (messages: Message | Message[]) => {
    if (Array.isArray(messages)) {
      return Promise.all(
        messages.map((message) =>
          kv.set(['messages', options.chatId, monotonicUlid()], message)
        ),
      )
    }

    return kv.set(['messages', options.chatId, monotonicUlid()], messages)
  }

  const clearMessages = async () => {
    const entries = kv.list<Message>({
      prefix: ['messages', options.chatId],
    })

    const deletePromises: Promise<void>[] = []
    for await (const entry of entries) {
      deletePromises.push(kv.delete(entry.key))
    }

    return Promise.all(deletePromises)
  }

  return {
    getAll,
    save,
    clearMessages,
  }
}
