/**
 * Event: messageCreate
 * Analyzes the FIRST message of unverified members using Gemini AI.
 * Posts status embeds to #automod throughout the analysis flow.
 * Marks the user as verified in the database after analysis.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isUnverified, markVerified } = require('../utils/database');
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

        // Only process if this user is in the DB and unverified
        if (!isUnverified(userId, guildId)) return;

        const automod = message.guild.channels.cache.find(
            (ch) => ch.name === AUTOMOD_CHANNEL_NAME && ch.isTextBased()
        );

        // --- Status 1: First message detected, starting analysis ---
        const pendingEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('First Message Detected')
            .setDescription('Running AI analysis...')
            .addFields(
                { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                { name: 'Message', value: message.content.slice(0, 1024) || '(empty)' }
            )
            .setTimestamp();

        let statusMessage = null;
        if (automod) {
            statusMessage = await automod.send({ embeds: [pendingEmbed] }).catch(() => null);
        }

        // --- Run AI analysis ---
        const { safe, raw } = await analyzeFirstMessage(
            message.content,
            message.author.tag
        );

        if (safe) {
            // Mark verified in the database
            markVerified(userId, guildId);

            const safeEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('First Message Cleared')
                .addFields(
                    { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                    { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                    { name: 'AI Verdict', value: raw, inline: true },
                    { name: 'Message', value: message.content.slice(0, 1024) || '(empty)' },
                    { name: 'Action', value: 'None - user is now AI verified' }
                )
                .setTimestamp();

            if (statusMessage) {
                await statusMessage.edit({ embeds: [safeEmbed] }).catch(() => { });
            }
            return;
        }

        // --- Unsafe: take action (do NOT mark as verified) ---

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

        // 3. Update status embed with result
        const flaggedEmbed = new EmbedBuilder()
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

        if (statusMessage) {
            await statusMessage.edit({ embeds: [flaggedEmbed] }).catch(() => { });
        } else if (automod) {
            await automod.send({ embeds: [flaggedEmbed] }).catch(() => { });
        }
    },
};
