/**
 * Centralized configuration — loaded from environment variables.
 *
 * Security notes:
 *  • Real values live in .env (git-ignored).
 *  • This module validates that every REQUIRED var is present at startup.
 *  • The exported object is frozen to prevent accidental runtime mutation.
 */

require('dotenv').config();

const REQUIRED = ['DISCORD_TOKEN', 'CLIENT_ID'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(
    `❌  Missing required environment variables: ${missing.join(', ')}\n` +
      '   Copy .env.example → .env and fill in the values.'
  );
  process.exit(1);
}

const config = Object.freeze({
  /** Discord bot token */
  token: process.env.DISCORD_TOKEN,

  /** Application (client) ID */
  clientId: process.env.CLIENT_ID,

  /**
   * Optional guild ID for development.
   * When set, slash commands are registered to this guild only (instant).
   * When empty, commands are registered globally (up to 1 h propagation).
   */
  guildId: process.env.GUILD_ID || null,
});

module.exports = config;
