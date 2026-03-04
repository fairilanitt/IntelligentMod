/**
 * /settings — View and configure bot settings for this server.
 *
 * Subcommands:
 *   view                      — Show current settings.
 *   aimoderation <on|off>     — Toggle AI first-message moderation.
 *   channel <name>            — Set the automod log channel name.
 *   timeout <duration>        — Set the timeout duration for flagged users.
 */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} = require('discord.js');
const { getSettings, saveSettings } = require('../utils/database');

const TIMEOUT_CHOICES = [
    { name: '5 minutes', value: '300000' },
    { name: '30 minutes', value: '1800000' },
    { name: '1 hour', value: '3600000' },
    { name: '6 hours', value: '21600000' },
    { name: '12 hours', value: '43200000' },
    { name: '24 hours', value: '86400000' },
    { name: '7 days', value: '604800000' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('View and configure bot settings for this server')
        .addSubcommand((sub) =>
            sub.setName('view').setDescription('Show current settings')
        )
        .addSubcommand((sub) =>
            sub
                .setName('aimoderation')
                .setDescription('Toggle AI first-message moderation')
                .addStringOption((opt) =>
                    opt
                        .setName('enabled')
                        .setDescription('Enable or disable')
                        .setRequired(true)
                        .addChoices(
                            { name: 'On', value: '1' },
                            { name: 'Off', value: '0' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('channel')
                .setDescription('Set the automod log channel name')
                .addStringOption((opt) =>
                    opt
                        .setName('name')
                        .setDescription('Channel name (without #)')
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('timeout')
                .setDescription('Set the timeout duration for flagged users')
                .addStringOption((opt) =>
                    opt
                        .setName('duration')
                        .setDescription('Timeout length')
                        .setRequired(true)
                        .addChoices(...TIMEOUT_CHOICES)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const settings = getSettings(guildId);

        if (sub === 'view') {
            const timeoutLabel =
                TIMEOUT_CHOICES.find((c) => c.value === String(settings.timeout_duration))?.name ??
                `${settings.timeout_duration}ms`;

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('Server Settings')
                .addFields(
                    {
                        name: 'AI Moderation',
                        value: settings.ai_moderation ? 'On' : 'Off',
                        inline: true,
                    },
                    {
                        name: 'Automod Channel',
                        value: `#${settings.automod_channel}`,
                        inline: true,
                    },
                    {
                        name: 'Timeout Duration',
                        value: timeoutLabel,
                        inline: true,
                    }
                );

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'aimoderation') {
            const enabled = parseInt(interaction.options.getString('enabled'), 10);
            saveSettings(guildId, { ai_moderation: enabled });

            return interaction.reply({
                content: `AI Moderation has been turned **${enabled ? 'On' : 'Off'}**.`,
                ephemeral: true,
            });
        }

        if (sub === 'channel') {
            const name = interaction.options
                .getString('name')
                .replace(/^#/, '')
                .toLowerCase()
                .trim();

            saveSettings(guildId, { automod_channel: name });

            return interaction.reply({
                content: `Automod channel set to **#${name}**.`,
                ephemeral: true,
            });
        }

        if (sub === 'timeout') {
            const duration = parseInt(interaction.options.getString('duration'), 10);
            saveSettings(guildId, { timeout_duration: duration });

            const label =
                TIMEOUT_CHOICES.find((c) => c.value === String(duration))?.name ?? `${duration}ms`;

            return interaction.reply({
                content: `Timeout duration set to **${label}**.`,
                ephemeral: true,
            });
        }
    },
};
