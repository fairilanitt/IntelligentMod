/**
 * deploy-commands.js
 *
 * Standalone script that reads every command file in ./commands/
 * and registers them with the Discord API.
 *
 * Usage:
 *   node src/deploy-commands.js          — guild deploy (instant, dev)
 *   node src/deploy-commands.js --global — global deploy (production)
 */

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const isGlobal = process.argv.includes('--global');

/* ---- Collect command JSON ---- */
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.warn(`⚠️  ${file} is missing "data" — skipped.`);
    }
}

/* ---- Deploy ---- */
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log(`🔄  Registering ${commands.length} command(s)…`);

        if (isGlobal) {
            await rest.put(Routes.applicationCommands(config.clientId), {
                body: commands,
            });
            console.log('✅  Global commands registered (may take up to 1 hour to propagate).');
        } else {
            if (!config.guildId) {
                console.error(
                    '❌  GUILD_ID is not set in .env.  Use --global for production, or set GUILD_ID for dev.'
                );
                process.exit(1);
            }
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            console.log('✅  Guild commands registered (instant).');
        }
    } catch (error) {
        console.error('❌  Failed to register commands:', error);
        process.exit(1);
    }
})();
