/**
 * /ping — Replies with the bot's WebSocket latency.
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),

    async execute(interaction) {
        const sent = await interaction.reply({
            content: '🏓 Pinging…',
            fetchReply: true,
        });

        const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
        const ws = interaction.client.ws.ping;

        await interaction.editReply(
            `🏓 **Pong!**  Roundtrip: **${roundTrip}ms** · WebSocket: **${ws}ms**`
        );
    },
};
