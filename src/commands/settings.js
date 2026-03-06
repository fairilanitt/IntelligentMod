/**
 * /settings — Interactive settings panel with buttons and modals.
 *
 * Shows a single embed with all current settings and action buttons.
 * Buttons trigger toggles or open text modals for configuration.
 */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require('discord.js');
const { getSettings, saveSettings } = require('../utils/database');
const { peek } = require('../utils/rateLimiter');

const TIMEOUT_LABELS = {
    300000: '5 minutes',
    1800000: '30 minutes',
    3600000: '1 hour',
    21600000: '6 hours',
    43200000: '12 hours',
    86400000: '24 hours',
    604800000: '7 days',
};

/** Build the settings embed for a guild. */
function buildSettingsEmbed(guildId) {
    const settings = getSettings(guildId);
    const hasKey = !!settings.gemini_api_key;
    const usage = peek(guildId);

    const timeoutLabel = TIMEOUT_LABELS[settings.timeout_duration] ?? `${settings.timeout_duration}ms`;

    const actionLabels = { timeout: 'Timeout', kick: 'Kick', ban: 'Ban' };

    const fields = [
        {
            name: 'AI Moderation',
            value: settings.ai_moderation ? 'On' : 'Off',
            inline: true,
        },
        {
            name: 'Moderation Action',
            value: actionLabels[settings.mod_action] || settings.mod_action,
            inline: true,
        },
        {
            name: 'Automod Channel',
            value: `#${settings.automod_channel}`,
            inline: true,
        },
    ];

    // Only show timeout duration when action is timeout
    if (settings.mod_action === 'timeout') {
        fields.push({
            name: 'Timeout Duration',
            value: timeoutLabel,
            inline: true,
        });
    }

    fields.push(
        {
            name: 'Custom API Key',
            value: hasKey ? 'Set (rate limit bypassed)' : 'Not set',
            inline: true,
        },
        {
            name: 'Rate Limit Usage',
            value: hasKey ? 'N/A (custom key)' : `${usage.used}/${usage.max} this hour`,
            inline: true,
        }
    );

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Server Settings')
        .setDescription('Use the buttons below to configure the bot.')
        .addFields(fields);
}

/** Build the button rows. */
function buildButtons(guildId) {
    const settings = getSettings(guildId);

    const actionLabels = { timeout: 'Timeout', kick: 'Kick', ban: 'Ban' };

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_toggle_ai')
            .setLabel(settings.ai_moderation ? 'Disable AI Moderation' : 'Enable AI Moderation')
            .setStyle(settings.ai_moderation ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('settings_cycle_action')
            .setLabel(`Action: ${actionLabels[settings.mod_action]}`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('settings_edit_channel')
            .setLabel('Set Channel')
            .setStyle(ButtonStyle.Secondary),
    );

    const row2Components = [
        new ButtonBuilder()
            .setCustomId('settings_edit_timeout')
            .setLabel('Set Timeout')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(settings.mod_action !== 'timeout'),
        new ButtonBuilder()
            .setCustomId('settings_edit_apikey')
            .setLabel(settings.gemini_api_key ? 'Change API Key' : 'Set API Key')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('settings_clear_apikey')
            .setLabel('Clear API Key')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!settings.gemini_api_key),
    ];

    const row2 = new ActionRowBuilder().addComponents(row2Components);

    return [row1, row2];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('View and configure bot settings for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    /** Send the initial settings panel. */
    async execute(interaction) {
        const embed = buildSettingsEmbed(interaction.guild.id);
        const buttons = buildButtons(interaction.guild.id);
        await interaction.reply({
            embeds: [embed],
            components: buttons,
            flags: MessageFlags.Ephemeral,
        });
    },

    /** Handle button interactions. */
    async handleComponent(interaction) {
        const guildId = interaction.guild.id;

        // --- Button: Toggle AI moderation ---
        if (interaction.customId === 'settings_toggle_ai') {
            const settings = getSettings(guildId);
            const newValue = settings.ai_moderation ? 0 : 1;
            saveSettings(guildId, { ai_moderation: newValue });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.update({ embeds: [embed], components: buttons });
            return;
        }

        // --- Button: Cycle moderation action (timeout → kick → ban → timeout) ---
        if (interaction.customId === 'settings_cycle_action') {
            const settings = getSettings(guildId);
            const cycle = { timeout: 'kick', kick: 'ban', ban: 'timeout' };
            const next = cycle[settings.mod_action] || 'timeout';
            saveSettings(guildId, { mod_action: next });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.update({ embeds: [embed], components: buttons });
            return;
        }

        // --- Button: Clear API key ---
        if (interaction.customId === 'settings_clear_apikey') {
            saveSettings(guildId, { gemini_api_key: null });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.update({ embeds: [embed], components: buttons });
            return;
        }

        // --- Button: Edit channel (open modal) ---
        if (interaction.customId === 'settings_edit_channel') {
            const modal = new ModalBuilder()
                .setCustomId('settings_modal_channel')
                .setTitle('Set Automod Channel')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('channel_name')
                            .setLabel('Channel name (without #)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('automod')
                            .setRequired(true)
                            .setMaxLength(100)
                    )
                );
            await interaction.showModal(modal);
            return;
        }

        // --- Button: Edit timeout (open modal) ---
        if (interaction.customId === 'settings_edit_timeout') {
            const modal = new ModalBuilder()
                .setCustomId('settings_modal_timeout')
                .setTitle('Set Timeout Duration')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('timeout_value')
                            .setLabel('Duration (e.g. 5m, 1h, 6h, 24h, 7d)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('24h')
                            .setRequired(true)
                            .setMaxLength(10)
                    )
                );
            await interaction.showModal(modal);
            return;
        }

        // --- Button: Edit API key (open modal) ---
        if (interaction.customId === 'settings_edit_apikey') {
            const modal = new ModalBuilder()
                .setCustomId('settings_modal_apikey')
                .setTitle('Set Custom Gemini API Key')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('api_key_value')
                            .setLabel('Gemini API key')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('AIza...')
                            .setRequired(true)
                            .setMaxLength(256)
                    )
                );
            await interaction.showModal(modal);
            return;
        }
    },

    /** Handle modal submissions. */
    async handleModal(interaction) {
        const guildId = interaction.guild.id;

        // --- Modal: Channel name ---
        if (interaction.customId === 'settings_modal_channel') {
            const name = interaction.fields
                .getTextInputValue('channel_name')
                .replace(/^#/, '')
                .toLowerCase()
                .trim();

            saveSettings(guildId, { automod_channel: name });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.reply({
                embeds: [embed],
                components: buttons,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // --- Modal: Timeout ---
        if (interaction.customId === 'settings_modal_timeout') {
            const input = interaction.fields.getTextInputValue('timeout_value').trim().toLowerCase();
            const ms = parseDuration(input);

            if (!ms) {
                await interaction.reply({
                    content: 'Invalid duration. Use formats like: 5m, 30m, 1h, 6h, 12h, 24h, 7d',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            saveSettings(guildId, { timeout_duration: ms });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.reply({
                embeds: [embed],
                components: buttons,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // --- Modal: API key ---
        if (interaction.customId === 'settings_modal_apikey') {
            const key = interaction.fields.getTextInputValue('api_key_value').trim();
            saveSettings(guildId, { gemini_api_key: key });

            const embed = buildSettingsEmbed(guildId);
            const buttons = buildButtons(guildId);
            await interaction.reply({
                embeds: [embed],
                components: buttons,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    },
};

/** Parse a human-friendly duration string to milliseconds. */
function parseDuration(str) {
    const match = str.match(/^(\d+)\s*(m|min|h|hr|hour|d|day)s?$/i);
    if (!match) return null;

    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'm':
        case 'min':
            return num * 60 * 1000;
        case 'h':
        case 'hr':
        case 'hour':
            return num * 60 * 60 * 1000;
        case 'd':
        case 'day':
            return num * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
}
