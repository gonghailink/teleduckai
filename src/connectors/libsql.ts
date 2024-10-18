import type {
  ClearMessagesOptions,
  DatabaseDriver,
  DatabaseOption,
} from '@/composables/database.ts'
import type { DuckModel } from '@/composables/duck-ai.ts'
import type { Message } from '@/composables/messages.ts'
import {
  type Client,
  createClient,
  type InArgs,
  type InStatement,
} from '@libsql/client'

export class LibSQLDriver implements DatabaseDriver {
  private chatId: number | undefined
  private config?: DatabaseOption
  private db: Client | undefined

  constructor(config?: DatabaseOption) {
    this.config = config
  }

  connect() {
    if (!this.config) throw new Error('Config not provided')
    if (!this.config.url) throw new Error('Database URL not provided')

    this.db = createClient({
      url: this.config.url,
      authToken: this.config.authToken,
    })

    this.db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, role TEXT, content TEXT, chat_id INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS vqd (chat_id INTEGER PRIMARY KEY, value TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS models (chat_id INTEGER PRIMARY KEY, model TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    `)
  }

  setChatId(chatId: number) {
    this.chatId = chatId

    return this
  }

  saveVqd(vqd: string) {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    return this.db.execute({
      sql:
        'INSERT INTO vqd (chat_id, value) VALUES(:chatId, :vqd) ON CONFLICT(chat_id) DO UPDATE SET value = :vqd',
      args: {
        chatId: this.chatId,
        vqd,
      },
    })
  }

  async getVqd() {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const { rows } = await this.db.execute({
      sql: `SELECT value FROM vqd WHERE chat_id = :chatId LIMIT 1`,
      args: {
        chatId: this.chatId,
      },
    })

    return rows[0]?.value as string | undefined
  }

  saveModel(model: string) {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    return this.db.execute({
      sql:
        `INSERT INTO models (chat_id, model) VALUES(:chatId, :model) ON CONFLICT(chat_id) DO UPDATE SET model = :model`,
      args: {
        chatId: this.chatId,
        model,
      },
    })
  }

  async getModel() {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const { rows } = await this.db.execute({
      sql: `SELECT model FROM models WHERE chat_id = :chatId LIMIT 1`,
      args: {
        chatId: this.chatId,
      },
    })

    return rows.at(0)?.model as DuckModel | undefined
  }

  async saveMessages(messages: Message | Message[]) {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    if (Array.isArray(messages)) {
      const placeholders = messages.map(() => '(?, ?, ?)').join(',')
      const args = messages.map((m) => [m.role, m.content, this.chatId])
        .flat() as InArgs

      return await this.db.execute({
        sql:
          `INSERT INTO messages (role, content, chat_id) VALUES ${placeholders}`,
        args,
      })
    }

    return await this.db.execute({
      sql:
        `INSERT INTO messages (role, content, chat_id) VALUES (:role, :content, :chatId)`,
      args: {
        role: messages.role,
        content: messages.content,
        chatId: this.chatId,
      },
    })
  }

  async getMessages(): Promise<Message[]> {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const { rows } = await this.db.execute({
      sql:
        `SELECT role, content FROM messages WHERE chat_id = :chatId ORDER BY created_at ASC`,
      args: { chatId: this.chatId },
    })

    return rows as unknown as Message[]
  }

  clearMessages(options: ClearMessagesOptions): Promise<unknown> {
    if (!this.db) throw new Error('DB not connected')
    if (!this.chatId) throw new Error('Chat ID not set')

    const statements: InStatement[] = [
      {
        sql: `DELETE FROM messages WHERE chat_id = :chatId`,
        args: { chatId: this.chatId },
      },
    ]

    if (options.vqd) {
      statements.push({
        sql: `DELETE FROM vqd WHERE chat_id = :chatId`,
        args: { chatId: this.chatId },
      })
    }

    if (options.model) {
      if (typeof options.model === 'string') {
        statements.push({
          sql:
            'INSERT INTO models (chat_id, model) VALUES(:chatId, :model) ON CONFLICT(chat_id) DO UPDATE SET model = :model',
          args: { chatId: this.chatId, model: options.model },
        })
      } else if (options.model === true) {
        statements.push({
          sql: 'DELETE FROM models WHERE chat_id = :chatId',
          args: { chatId: this.chatId },
        })
      }
    }

    return this.db.batch(statements, 'write')
  }
}
