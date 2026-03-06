/**
 * Event: interactionCreate
 * Routes slash commands, button clicks, and modal submissions.
 */

const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // --- Slash commands ---
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`No handler for command: ${interaction.commandName}`);
                    return;
                }
                await command.execute(interaction);
                return;
            }

            // --- Buttons ---
            if (interaction.isButton()) {
                // Route settings_* buttons to the settings command handler
                if (interaction.customId.startsWith('settings_')) {
                    const settings = interaction.client.commands.get('settings');
                    if (settings?.handleComponent) {
                        await settings.handleComponent(interaction);
                    }
                    return;
                }
            }

            // --- Modals ---
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('settings_modal_')) {
                    const settings = interaction.client.commands.get('settings');
                    if (settings?.handleModal) {
                        await settings.handleModal(interaction);
                    }
                    return;
                }
            }
        } catch (error) {
            console.error('Interaction error:', error);

            const reply = {
                content: 'Something went wrong while processing that interaction.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => { });
            } else {
                await interaction.reply(reply).catch(() => { });
            }
        }
    },
};
