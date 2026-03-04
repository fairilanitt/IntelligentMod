# IntelligentMod

A modular Discord moderation bot framework — secure and ready for public distribution.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token from the [Developer Portal](https://discord.com/developers/applications) |
| `CLIENT_ID` | ✅ | Application ID (General Information page) |
| `GUILD_ID` | ❌ | A server ID for instant dev command registration |

### 3. Register slash commands

```bash
# Development — instant, single guild
npm run deploy

# Production — global (up to 1 h propagation)
npm run deploy -- --global
```

### 4. Start the bot

```bash
npm start

# Or with auto-restart on file changes (Node 18.11+):
npm run dev
```

## Adding a New Command

1. Create `src/commands/yourcommand.js`:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yourcommand')
    .setDescription('Does something cool'),

  async execute(interaction) {
    await interaction.reply('Hello!');
  },
};
```

2. Re-run `npm run deploy` to register the new command with Discord.

## Project Structure

```
IntelligentMod/
├── .env.example        # Template — safe to commit
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── index.js            # Entry point — client setup & login
    ├── config.js           # Env validation & frozen config
    ├── deploy-commands.js  # Slash command registration utility
    ├── commands/
    │   ├── ping.js         # /ping — latency check
    │   └── info.js         # /info — bot stats embed
    └── events/
        ├── ready.js            # Fires on successful login
        └── interactionCreate.js # Routes slash commands
```

## Security

- **No secrets in source** — token & IDs live in `.env` (git-ignored).
- **Startup validation** — the bot refuses to start if required env vars are missing.
- **Frozen config** — `Object.freeze()` prevents runtime mutation.
- **Global error handling** — `unhandledRejection` & `uncaughtException` are caught.
- **Graceful command errors** — failed commands reply to the user instead of crashing the process.

## Bot Permissions

This bot is designed for **moderation**, so it requests broad intents:

- `Guilds`, `GuildMembers`, `GuildModeration`
- `GuildMessages`, `MessageContent`, `GuildMessageReactions`
- `DirectMessages`

> **Note:** You must enable the **Server Members Intent** and **Message Content Intent** in the [Developer Portal](https://discord.com/developers/applications) → Bot → Privileged Gateway Intents.

## License

MIT
