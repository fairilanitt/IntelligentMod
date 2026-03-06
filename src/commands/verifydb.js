/**
 * /verifydb — View and manage the AI verification database.
 *
 * Subcommands:
 *   view [user]  — View a single user's record or list all records.
 *   set <user> <status> — Manually set a user's verified status.
 *   remove <user> — Remove a user from the database.
 */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');
const {
    getUser,
    listUsers,
    countUsers,
    setVerified,
    deleteUser,
    addJoiner,
} = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifydb')
        .setDescription('View and manage the AI verification database')
        .addSubcommand((sub) =>
            sub
                .setName('view')
                .setDescription('View verification records')
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('View a specific user (leave empty to list all)')
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('page')
                        .setDescription('Page number (default 1)')
                        .setMinValue(1)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('set')
                .setDescription('Set a user\'s verification status')
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('Target user').setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('status')
                        .setDescription('Verified or unverified')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Verified', value: '1' },
                            { name: 'Unverified', value: '0' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove a user from the database')
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('Target user').setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'view') {
            const target = interaction.options.getUser('user');

            if (target) {
                // View a single user
                const record = getUser(target.id, guildId);

                if (!record) {
                    return interaction.reply({
                        content: `No record found for ${target.tag}.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(record.verified ? 0x2ecc71 : 0xe74c3c)
                    .setTitle('Verification Record')
                    .addFields(
                        { name: 'User', value: `${target.tag}`, inline: true },
                        { name: 'ID', value: record.user_id, inline: true },
                        {
                            name: 'Status',
                            value: record.verified ? 'Verified' : 'Unverified',
                            inline: true,
                        },
                        { name: 'Joined At', value: record.joined_at, inline: true },
                        {
                            name: 'Verified At',
                            value: record.verified_at || 'N/A',
                            inline: true,
                        }
                    );

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // List all users for this guild
            const page = interaction.options.getInteger('page') ?? 1;
            const perPage = 10;
            const offset = (page - 1) * perPage;
            const total = countUsers(guildId);
            const records = listUsers(guildId, perPage, offset);

            if (records.length === 0) {
                return interaction.reply({
                    content: 'No records in the verification database.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const totalPages = Math.ceil(total / perPage);

            const lines = records.map((r) => {
                const status = r.verified ? 'Verified' : 'Unverified';
                return `<@${r.user_id}> — ${status} — Joined: ${r.joined_at.split('T')[0]}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('Verification Database')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Page ${page}/${totalPages} | ${total} total records` });

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'set') {
            const target = interaction.options.getUser('user');
            const status = parseInt(interaction.options.getString('status'), 10);

            // Ensure user exists in DB first
            let record = getUser(target.id, guildId);
            if (!record) {
                addJoiner(target.id, guildId);
            }

            setVerified(target.id, guildId, status);

            const label = status === 1 ? 'Verified' : 'Unverified';
            return interaction.reply({
                content: `${target.tag} has been set to **${label}**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'remove') {
            const target = interaction.options.getUser('user');
            const result = deleteUser(target.id, guildId);

            if (result.changes === 0) {
                return interaction.reply({
                    content: `No record found for ${target.tag}.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content: `${target.tag} has been removed from the database.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
