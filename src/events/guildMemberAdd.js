/**
 * Event: guildMemberAdd
 * Sends a notification embed to #automod when a new user joins.
 * Inserts the user into the SQLite verification database as unverified.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { addJoiner, getSettings } = require('../utils/database');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        // Insert into DB as unverified
        addJoiner(member.id, member.guild.id);

        const settings = getSettings(member.guild.id);
        const channel = member.guild.channels.cache.find(
            (ch) => ch.name === settings.automod_channel && ch.isTextBased()
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
