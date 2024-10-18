import { Bot, InlineKeyboard } from 'grammy'
import {
  type DuckModel,
  getModelByCode,
  models,
} from '@/composables/duck-ai.ts'
import { useDB, useKv } from '@/db.ts'

export interface MessageQueue {
  chatId: number
  messageId: number
  firstName: string
  userName?: string
  model: DuckModel
  message: string
}

const bot = new Bot(Deno.env.get('TELEGRAM_BOT_TOKEN')!)
const kv = await useKv()
const db = await useDB()

bot.command('start', async (ctx) => {
  const inlineKeyboard = InlineKeyboard.from(
    Object.entries(models).map((
      [label, data],
    ) => [InlineKeyboard.text(label, data)]),
  )

  db?.setChatId(ctx.chat.id)

  db?.clearMessages({
    messages: true,
    vqd: true,
    model: true,
  })

  await ctx.reply(
    "Welcome! Before we begin, please choose the AI model you'd like to interact with:",
    { reply_markup: inlineKeyboard },
  )
})

bot.on('callback_query:data', async (ctx) => {
  const selectedModel = getModelByCode(ctx.callbackQuery.data)
  const chatId = ctx.callbackQuery.message!.chat.id!
  db?.setChatId(chatId)

  await Promise.all([
    ctx.answerCallbackQuery({ text: `Selected model: ${selectedModel}` }),
    ctx.deleteMessage(),
    ctx.reply(
      `Great! You've selected the <b>${selectedModel}</b>.\nLet's get started! Feel free to ask me anything.`,
      { parse_mode: 'HTML' },
    ),
    db?.clearMessages({
      messages: true,
      vqd: true,
      model: ctx.callbackQuery.data,
    }),
  ])
})

bot.on('message:text', async (ctx) => {
  if (ctx.update.message.chat.type !== 'private') return

  db?.setChatId(ctx.chat.id)

  const model = await db?.getModel()

  if (!model) {
    return ctx.reply(
      `Oops, it seems like you haven't chosen a model yet.\nPlease type /start to select an AI model and begin a new conversation.`,
    )
  }

  const message: MessageQueue = {
    chatId: ctx.chat.id,
    messageId: ctx.message.message_id,
    firstName: ctx.message.from.first_name,
    userName: ctx.message.from.username,
    model: model,
    message: ctx.message.text,
  }

  await kv.enqueue(message)
})

export { bot }
