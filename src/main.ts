import { Bot, type Context, InlineKeyboard, webhookCallback } from 'grammy'
import {
  type DuckModel,
  getModelByCode,
  models,
  useDuckAi,
} from './utils/duck-ai.ts'
import { useMessages } from './utils/messages.ts'
import telegramify from 'telegramify-markdown'
import {
  autoChatAction,
  type AutoChatActionFlavor,
  chatAction,
} from '@grammyjs/auto-chat-action'
import 'jsr:@std/dotenv/load'

if (!Deno.env.get('TELEGRAM_BOT_TOKEN')) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set')
}

const bot = new Bot<Context & AutoChatActionFlavor>(
  Deno.env.get('TELEGRAM_BOT_TOKEN') || '',
)

bot.use(autoChatAction())

const kv = await Deno.openKv()

bot.command('start', (ctx) => {
  const inlineKeyboard = InlineKeyboard.from(
    Object.entries(models).map((
      [label, data],
    ) => [InlineKeyboard.text(label, data)]),
  )

  const { clearMessages } = useMessages({
    chatId: ctx.chat.id,
    kv,
  })

  // also clear the vqd and the saved model
  Promise.all([
    clearMessages(),
    kv.delete(['vqd', ctx.chat.id]),
    kv.delete(['model', ctx.chat.id]),
  ])

  const greeting =
    `Welcome! Before we begin, please choose the AI model you\'d like to interact with:`

  ctx.reply(greeting, {
    reply_markup: inlineKeyboard,
  })
})

bot.on('callback_query:data', (ctx) => {
  const selectedModel = getModelByCode(ctx.callbackQuery.data)

  Promise.all([
    ctx.answerCallbackQuery({
      text: `Selected model: ${selectedModel}`,
    }),
    ctx.deleteMessage(),
    ctx.reply(
      `Great! You've selected the <b>${selectedModel}</b>.\nLets's get started! Feel free to ask me anything.`,
      {
        parse_mode: 'HTML',
      },
    ),
  ])

  // Fix for when the user executes the /start command multiple times and selects a model repeatedly, so we need to clear again
  const { clearMessages } = useMessages({
    chatId: ctx.callbackQuery.message!.chat.id!,
    kv,
  })

  Promise.all([
    clearMessages(),
    kv.delete(['vqd', ctx.callbackQuery.message!.chat.id!]),
    kv.set(
      ['model', ctx.callbackQuery.message!.chat.id!],
      ctx.callbackQuery.data,
    ),
  ])
})

bot.on('message:text', chatAction('typing'), async (ctx) => {
  if (ctx.update.message.chat.type !== 'private') return

  const model = await kv.get<DuckModel>(['model', ctx.chat.id])

  if (!model.value) {
    return ctx.reply(
      `Oops, it seems like you haven't chosen a model yet.\nPlease type /start to select an AI model and begin a new conversation.`,
    )
  }

  const duck = useDuckAi({
    chatId: ctx.chat.id,
    kv,
    model: model.value,
  })

  const response = await duck.chat(ctx.message.text)

  try {
    ctx.reply(telegramify(response.message), {
      parse_mode: 'MarkdownV2',
    })
  } catch {
    return ctx.reply('Something went wrong. Please try again later.')
  } finally {
    console.log({
      'chat_id': ctx.chat.id,
      'user_name': ctx.update.message.from.username || '',
      'full_name': ctx.update.message.from.first_name || '',
      'message': ctx.update.message.text || '',
      'model': model.value,
      'response': response,
    })
  }
})

if (Deno.env.get('TELEGRAM_BOT_MODE') === 'longpolling') {
  bot.start()
} else {
  const handleUpdate = webhookCallback(bot, 'std/http')

  Deno.serve(async (req) => {
    if (req.method === 'POST') {
      const url = new URL(req.url)
      if (url.pathname.slice(1) === bot.token) {
        try {
          return await handleUpdate(req)
        } catch (err) {
          console.error(err)
        }
      }
    }
    return new Response()
  })
}
