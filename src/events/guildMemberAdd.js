/**
 * Event: guildMemberAdd
 * Sends a notification embed to #automod when a new user joins.
 * Registers the member for first-message AI analysis.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { markPending } = require('../utils/newMembers');

const AUTOMOD_CHANNEL_NAME = 'automod';

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        // Register for first-message analysis
        markPending(member.guild.id, member.id);

        const channel = member.guild.channels.cache.find(
            (ch) => ch.name === AUTOMOD_CHANNEL_NAME && ch.isTextBased()
        );

        if (!channel) return;

        const createdAt = Math.floor(member.user.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
            .setColor(0x2f3136)
            .setTitle('Member Joined')
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'User', value: `${member.user.tag}`, inline: true },
                { name: 'ID', value: `${member.id}`, inline: true },
                {
                    name: 'Account Created',
                    value: `<t:${createdAt}:R>`,
                    inline: true,
                },
                {
                    name: 'Member Count',
                    value: `${member.guild.memberCount}`,
                    inline: true,
                }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => { });
    },
};

