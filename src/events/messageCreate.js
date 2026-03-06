/**
 * Event: messageCreate
 * Analyzes the FIRST message of unverified members using Gemini AI.
 * Posts status embeds to #automod throughout the analysis flow.
 * Marks the user as verified in the database after analysis.
 *
 * Rate limiting: guilds using the shared (global) API key are limited
 * to 20 AI checks per hour. Guilds with their own API key bypass this.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { isUnverified, markVerified, getSettings, hasCustomKey } = require('../utils/database');
const { analyzeFirstMessage } = require('../utils/gemini');
const { consume, peek } = require('../utils/rateLimiter');

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

        // Check guild settings
        const settings = getSettings(guildId);
        if (!settings.ai_moderation) return;

        const guildHasKey = hasCustomKey(guildId);

        // Rate limiting — only applies when using the shared global key
        if (!guildHasKey) {
            const limit = consume(guildId);
            if (!limit.allowed) {
                const automod = message.guild.channels.cache.find(
                    (ch) => ch.name === settings.automod_channel && ch.isTextBased()
                );
                if (automod) {
                    const resetMin = Math.ceil(limit.resetInMs / 60000);
                    const embed = new EmbedBuilder()
                        .setColor(0x95a5a6)
                        .setTitle('Rate Limit Reached')
                        .setDescription(
                            `This server has used all 20 AI checks for this hour.\n` +
                            `Resets in approximately ${resetMin} minute(s).\n\n` +
                            `Server admins can set a custom API key via \`/settings apikey\` to remove this limit.`
                        )
                        .setTimestamp();
                    await automod.send({ embeds: [embed] }).catch(() => { });
                }
                return;
            }
        }

        const automod = message.guild.channels.cache.find(
            (ch) => ch.name === settings.automod_channel && ch.isTextBased()
        );

        // --- Status 1: First message detected, starting analysis ---
        const usageInfo = guildHasKey ? 'Custom API key' : (() => {
            const p = peek(guildId);
            return `${p.used}/${p.max} checks used this hour`;
        })();

        const pendingEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('First Message Detected')
            .setDescription('Running AI analysis...')
            .addFields(
                { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                { name: 'Rate Limit', value: usageInfo, inline: true },
                { name: 'Message', value: message.content.slice(0, 1024) || '(empty)' }
            )
            .setTimestamp();

        let statusMessage = null;
        if (automod) {
            statusMessage = await automod.send({ embeds: [pendingEmbed] }).catch(() => null);
        }

        // --- Run AI analysis (use guild key if available) ---
        const { safe, raw } = await analyzeFirstMessage(
            message.content,
            message.author.tag,
            settings.gemini_api_key
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
                    { name: 'AI Verdict', value: 'This message was deemed as safe.', inline: true },
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

        // 2. Execute configured moderation action
        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        let actionDescription = 'Message deleted';
        const action = settings.mod_action || 'timeout';

        if (member) {
            switch (action) {
                case 'ban':
                    if (member.bannable) {
                        await member.ban({ reason: 'AI flagged first message as unsafe' }).catch(() => { });
                        actionDescription = 'Message deleted, user banned';
                    }
                    break;
                case 'kick':
                    if (member.kickable) {
                        await member.kick('AI flagged first message as unsafe').catch(() => { });
                        actionDescription = 'Message deleted, user kicked';
                    }
                    break;
                case 'timeout':
                default:
                    if (member.moderatable) {
                        await member
                            .timeout(settings.timeout_duration, 'AI flagged first message as unsafe')
                            .catch(() => { });
                        actionDescription = 'Message deleted, user timed out';
                    }
                    break;
            }
        }

        // 3. Update status embed with result
        const flaggedEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('First Message Flagged')
            .addFields(
                { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                { name: 'AI Verdict', value: 'This message was deemed as harmful.', inline: true },
                { name: 'Message Content', value: message.content.slice(0, 1024) || '(empty)' },
                { name: 'Action Taken', value: actionDescription }
            )
            .setTimestamp();

        if (statusMessage) {
            await statusMessage.edit({ embeds: [flaggedEmbed] }).catch(() => { });
        } else if (automod) {
            await automod.send({ embeds: [flaggedEmbed] }).catch(() => { });
        }
    },
};
