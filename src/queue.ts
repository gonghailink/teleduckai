import { bot, MessageQueue } from '@/bot.ts'
import { useKv } from '@/db.ts'
import { useDuckAi } from '@/composables/duck-ai.ts'
import telegramify from 'telegramify-markdown'

const kv = await useKv()

function isMessage(queue: unknown): queue is MessageQueue {
  return queue !== null && typeof queue === 'object' &&
    'chatId' in queue &&
    'model' in queue &&
    'message' in queue
}

kv.listenQueue(async (msg: unknown) => {
  if (!isMessage(msg)) return

  const duck = useDuckAi({
    chatId: msg.chatId,
    model: msg.model,
  })

  const typing = setInterval(
    () => bot.api.sendChatAction(msg.chatId, 'typing'),
    5_000,
  )

  try {
    const response = await duck.chat(msg.message)

    const content = telegramify(response.message)

    console.info({
      chat_id: msg.chatId,
      user_name: msg.userName || '-',
      first_name: msg.firstName,
      message: msg.message,
      model: msg.model,
      vqd: response.vqd,
      response: content,
    })

    await bot.api.sendMessage(msg.chatId, content, {
      parse_mode: 'MarkdownV2',
    })
  } catch (error) {
    console.error(error)
    await bot.api.sendMessage(
      msg.chatId,
      'Something went wrong. Please try again later.',
    )
  } finally {
    clearInterval(typing)
  }
})
