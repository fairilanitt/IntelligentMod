/**
 * /info — Displays bot statistics in a rich embed.
 */

const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Show bot information and statistics'),

    async execute(interaction) {
        const { client } = interaction;

        const uptimeSeconds = Math.floor(client.uptime / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const embed = new EmbedBuilder()
            .setColor(0x5865f2) // Discord blurple
            .setTitle('📊  Bot Information')
            .addFields(
                { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
                { name: 'Users', value: `${client.users.cache.size}`, inline: true },
                {
                    name: 'Uptime',
                    value: `${hours}h ${minutes}m ${seconds}s`,
                    inline: true,
                },
                {
                    name: 'discord.js',
                    value: `v${version}`,
                    inline: true,
                },
                {
                    name: 'Node.js',
                    value: process.version,
                    inline: true,
                },
                {
                    name: 'Memory',
                    value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
                    inline: true,
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
