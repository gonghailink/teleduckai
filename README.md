# TeleDuckAI

TeleDuckAI is a Telegram bot powered by Duck.ai, built using Deno. This project was created purely for fun and as a way to experiment in my free time.

## Features

- Integration with Duck.ai
- Built with Deno
- Fast and intelligent responses via Telegram chat
- Supports webhook mode

## Requirements

- Latest version of [Deno](https://deno.land/)
- A Telegram account and bot token (obtainable via [BotFather](https://t.me/BotFather))

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/radyakaze/teleduckai.git
   cd teleduckai
   ```

2. Set up your environment variables by creating a `.env` file and adding your Telegram bot token:

   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   ```

3. Run the project:

   ```bash
   deno task start
   ```

## Webhook Mode

To simplify the webhook setup, use this script to configure your webhook:

```bash
curl "https://api.telegram.org/${BOT_TOKEN}/setWebhook?url=${YOUR_SITE}/${BOT_TOKEN}&allowed_updates[]=message&allowed_updates[]=callback_query&drop_pending_updates=true"
```

Replace `${BOT_TOKEN}` with your actual Telegram bot token and `${YOUR_SITE}` with your server URL. This script will set the webhook to receive only messages and callback queries, while also dropping any pending updates.

__Deno Deploy offers serverless functions, which can be used to handle the webhook for your bot. You can deploy your bot as a serverless function and use the provided URL for your webhook setup.__

## Contribution

We welcome contributions via pull requests. Please open an issue first for any discussion about features or fixes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Why This Project?

This project was built just for fun during free time, as a playful way to experiment with AI and bot development.
