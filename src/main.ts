import { webhookCallback } from 'grammy'
import { bot } from '@/bot.ts'
import '@/queue.ts'
import 'jsr:@std/dotenv/load'

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

if (Deno.env.get('TELEGRAM_BOT_MODE') === 'longpolling') {
  bot.start()
} else {
  const handleUpdate = webhookCallback(bot, 'std/http')

  Deno.serve(async (req) => {
    if (req.method === 'POST' && new URL(req.url).pathname.slice(1) === TOKEN) {
      try {
        return await handleUpdate(req)
      } catch (err) {
        console.error(err)
        return new Response('Error', { status: 500 })
      }
    }
    return new Response('Not Found', { status: 404 })
  })
}
