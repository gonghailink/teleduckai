import type { Message } from './messages.ts'
import type { DuckModel } from './duck-ai.ts'
import { LibSQLDriver } from '@/connectors/libsql.ts'
import { DenoKVDriver } from '@/connectors/kv.ts'

export interface ClearMessagesOptions {
  messages: boolean
  vqd: boolean
  model: boolean | string
}

export interface DatabaseOption {
  url?: string
  authToken?: string
}

export const drivers = ['kv', 'libsql'] as const

export type DriverType = typeof drivers[number]

export interface DatabaseDriver {
  connect(): Promise<unknown> | unknown
  setChatId(chatId: number): unknown
  saveModel(model: string): Promise<unknown>
  getModel(): Promise<DuckModel | undefined | null>
  saveVqd(vqd: string): Promise<unknown>
  getVqd(): Promise<string | null | undefined>
  saveMessages(messages: Message | Message[]): Promise<unknown>
  getMessages(): Promise<Message[]>
  clearMessages(options: ClearMessagesOptions): Promise<unknown>
}

export const useDatabase = async (
  driver: DriverType,
  options: DatabaseOption,
) => {
  if (driver === 'libsql') {
    const libsql = new LibSQLDriver(options)

    libsql.connect()

    return libsql
  }

  if (driver === 'kv') {
    const kv = new DenoKVDriver()

    await kv.connect()

    return kv
  }
}
