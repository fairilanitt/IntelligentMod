/**
 * IntelligentMod — Entry Point
 *
 * Creates the Discord client with the intents needed for moderation,
 * dynamically loads all events & commands, then logs in.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
    Client,
    Collection,
    GatewayIntentBits,
    Partials,
} = require('discord.js');
const config = require('./config');

/* ------------------------------------------------------------------ */
/*  Create the client with broad moderation-focused intents            */
/* ------------------------------------------------------------------ */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,       // ban / kick events
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,         // read message text
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Channel,   // required for DM events
        Partials.Message,
        Partials.Reaction,
    ],
});

/* ------------------------------------------------------------------ */
/*  Load commands                                                      */
/* ------------------------------------------------------------------ */
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(
                `⚠️  Command file ${file} is missing "data" or "execute" — skipped.`
            );
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Load events                                                        */
/* ------------------------------------------------------------------ */
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Global error safety net                                            */
/* ------------------------------------------------------------------ */
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    // Intentionally NOT calling process.exit() — let the bot try to stay alive.
});

/* ------------------------------------------------------------------ */
/*  Login                                                              */
/* ------------------------------------------------------------------ */
client.login(config.token);
