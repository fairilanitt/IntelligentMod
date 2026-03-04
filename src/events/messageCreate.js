/**
 * Event: messageCreate
 * Analyzes the FIRST message of newly joined members using Gemini AI.
 * If the AI flags the message as unsafe, the bot deletes it, times out
 * the user, and logs the action to #automod.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isPending, clearPending } = require('../utils/newMembers');
const { analyzeFirstMessage } = require('../utils/gemini');

const AUTOMOD_CHANNEL_NAME = 'automod';

module.exports = {
    name: Events.MessageCreate,
    once: false,

    async execute(message) {
        // Ignore bots, DMs, and system messages
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        // Only process if this user is pending first-message analysis
        if (!isPending(guildId, userId)) return;

        // Clear immediately so we only analyze one message per join
        clearPending(guildId, userId);

        const { safe, raw } = await analyzeFirstMessage(
            message.content,
            message.author.tag
        );

        // Safe message — no action needed
        if (safe) return;

        // --- Unsafe message: take action ---

        // 1. Delete the message
        await message.delete().catch(() => { });

        // 2. Timeout the user for 24 hours
        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        if (member && member.moderatable) {
            await member
                .timeout(24 * 60 * 60 * 1000, 'AI flagged first message as unsafe')
                .catch(() => { });
        }

        // 3. Log to #automod
        const automod = message.guild.channels.cache.find(
            (ch) => ch.name === AUTOMOD_CHANNEL_NAME && ch.isTextBased()
        );

        if (!automod) return;

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('First Message Flagged')
            .addFields(
                { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                { name: 'AI Verdict', value: raw, inline: true },
                { name: 'Message Content', value: message.content.slice(0, 1024) || '(empty)' },
                { name: 'Action Taken', value: 'Message deleted, user timed out for 24h' }
            )
            .setTimestamp();

        await automod.send({ embeds: [embed] }).catch(() => { });
    },
};
