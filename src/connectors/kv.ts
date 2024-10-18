import type {
  ClearMessagesOptions,
  DatabaseDriver,
} from '@/composables/database.ts'
import type { DuckModel } from '@/composables/duck-ai.ts'
import type { Message } from '@/composables/messages.ts'
import { monotonicUlid } from '@std/ulid'
import { useKv } from '@/db.ts'

export class DenoKVDriver implements DatabaseDriver {
  private chatId: number | undefined
  private kv: Deno.Kv | undefined

  async connect() {
    this.kv = await useKv()
  }

  setChatId(chatId: number) {
    this.chatId = chatId

    return this
  }

  saveVqd(vqd: string) {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    return this.kv.set(['vqd', this.chatId], vqd)
  }

  async getVqd() {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const vqd = await this.kv.get<string>(['vqd', this.chatId])

    return vqd.value
  }

  saveModel(model: string) {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    return this.kv.set(['model', this.chatId], model)
  }

  async getModel() {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const model = await this.kv.get<DuckModel>(['model', this.chatId])

    return model.value
  }

  saveMessages(messages: Message | Message[]) {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const atomic = this.kv.atomic()
    const messagesToSave = Array.isArray(messages) ? messages : [messages]

    messagesToSave.forEach((message) => {
      atomic.set(['messages', this.chatId!, monotonicUlid()], message)
    })

    return atomic.commit()
  }

  async getMessages(): Promise<Message[]> {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const entries = this.kv.list<Message>({
      prefix: ['messages', this.chatId],
    })

    return await Array.fromAsync(entries, (entry) => entry.value)
  }

  async clearMessages(options: ClearMessagesOptions): Promise<unknown> {
    if (!this.kv) throw new Error('KV not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const entries = this.kv.list<Message>({
      prefix: ['messages', this.chatId],
    })

    const atomic = this.kv.atomic()

    for await (const entry of entries) {
      atomic.delete(entry.key)
    }

    if (options.vqd) {
      atomic.delete(['vqd', this.chatId])
    }

    if (options.model) {
      options.model === true
        ? atomic.delete(['model', this.chatId])
        : typeof options.model === 'string' &&
          atomic.set(['model', this.chatId], options.model)
    }

    return atomic.commit()
  }
}
