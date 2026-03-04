/**
 * Event: interactionCreate
 * Routes incoming slash-command interactions to the matching command handler.
 */

const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Only handle chat-input (slash) commands for now.
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.warn(`⚠️  No handler for command: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing /${interaction.commandName}:`, error);

            const reply = {
                content: '❌ Something went wrong while running that command.',
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => { });
            } else {
                await interaction.reply(reply).catch(() => { });
            }
        }
    },
};
