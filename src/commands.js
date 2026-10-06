const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const administrator = PermissionFlagsBits.Administrator;
const commands = [
  new SlashCommandBuilder()
    .setName('ban').setDescription('Permanently ban a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban').setMaxLength(500)),
  new SlashCommandBuilder()
    .setName('timeban').setDescription('Ban a member for a set duration.')
    .addUserOption((option) => option.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('Duration such as 30m, 2h, 3d, or 1w').setRequired(true).setMinLength(2).setMaxLength(5))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban').setMaxLength(500)),
  new SlashCommandBuilder()
    .setName('unban').setDescription('Unban a user by their ID.')
    .addStringOption((option) => option.setName('user_id').setDescription('User ID to unban').setRequired(true)),
  new SlashCommandBuilder()
    .setName('kick').setDescription('Kick a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick').setMaxLength(500)),
  new SlashCommandBuilder()
    .setName('timeout').setDescription('Timeout a member for up to 5 minutes.')
    .addUserOption((option) => option.setName('user').setDescription('Member to timeout').setRequired(true)),
  new SlashCommandBuilder()
    .setName('untimeout').setDescription('Remove a member timeout.')
    .addUserOption((option) => option.setName('user').setDescription('Member to untimeout').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge').setDescription('Delete 1 to 100 recent messages in this channel.')
    .addIntegerOption((option) => option.setName('amount').setDescription('Number of messages').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('lock').setDescription('Prevent members from sending messages in this channel.'),
  new SlashCommandBuilder().setName('unlock').setDescription('Allow members to send messages in this channel.'),
  new SlashCommandBuilder()
    .setName('role').setDescription('Give a member a role.')
    .addUserOption((option) => option.setName('user').setDescription('Member to update').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role to add').setRequired(true)),
  new SlashCommandBuilder()
    .setName('removerole').setDescription('Remove a role from a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to update').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(true)),
].map((command) => command.setDefaultMemberPermissions(administrator).setDMPermission(false));

const durationMultipliers = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

async function execute(interaction, temporaryBans) {
  if (!interaction.memberPermissions?.has(administrator)) {
    return interaction.reply({ content: 'Administrator permission is required.', ephemeral: true });
  }

  const { guild, member, channel } = interaction;
  const botMember = guild.members.me;
  const user = interaction.options.getUser('user');
  const target = user ? await guild.members.fetch(user.id).catch(() => null) : null;
  const reason = interaction.options.getString('reason') || `Action by ${interaction.user.tag}`;
  const requireTarget = () => {
    if (!target) throw new Error('That user is not a member of this server.');
    if (target.id === interaction.user.id) throw new Error('You cannot use this command on yourself.');
    if (target.id === botMember.id) throw new Error('You cannot use this command on the bot.');
    if (target.roles.highest.position >= member.roles.highest.position && guild.ownerId !== interaction.user.id) {
      throw new Error('Your highest role must be above the target member’s highest role.');
    }
    if (target.roles.highest.position >= botMember.roles.highest.position) {
      throw new Error('The bot’s highest role must be above the target member’s highest role.');
    }
  };

  try {
    switch (interaction.commandName) {
      case 'ban':
        requireTarget();
        await target.ban({ reason });
        await temporaryBans.cancel(guild.id, target.id);
        return interaction.reply(`${target.user.tag} was banned. Reason: ${reason}`);
      case 'timeban': {
        requireTarget();
        const duration = interaction.options.getString('duration').match(/^([1-9]\d{0,3})([mhdw])$/i);
        if (!duration) throw new Error('Use a duration like 30m, 2h, 3d, or 1w.');
        const amount = Number(duration[1]);
        const unit = duration[2].toLowerCase();
        const expiresAt = Date.now() + amount * durationMultipliers[unit];
        await target.ban({ reason });
        await temporaryBans.schedule(guild.id, target.id, expiresAt);
        return interaction.reply(`${target.user.tag} was banned for ${amount}${unit}. Reason: ${reason}`);
      }
      case 'unban': {
        const userId = interaction.options.getString('user_id');
        await guild.bans.remove(userId, reason);
        await temporaryBans.cancel(guild.id, userId);
        return interaction.reply(`User ${userId} was unbanned.`);
      }
      case 'kick':
        requireTarget();
        await target.kick(reason);
        return interaction.reply(`${target.user.tag} was kicked. Reason: ${reason}`);
      case 'timeout':
        requireTarget();
        await target.timeout(5 * 60 * 1000, reason);
        return interaction.reply(`${target.user.tag} was timed out for 5 minutes.`);
      case 'untimeout':
        requireTarget();
        await target.timeout(null, reason);
        return interaction.reply(`Timeout removed for ${target.user.tag}.`);
      case 'purge': {
        const amount = interaction.options.getInteger('amount');
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
          throw new Error('This command requires a server text channel.');
        }
        const deleted = await channel.bulkDelete(amount, true);
        return interaction.reply({ content: `Deleted ${deleted.size} recent messages.`, ephemeral: true });
      }
      case 'lock':
      case 'unlock': {
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
          throw new Error('This command requires a server text channel.');
        }
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: interaction.commandName === 'unlock' ? null : false,
          SendMessagesInThreads: interaction.commandName === 'unlock' ? null : false,
        }, { reason });
        return interaction.reply(`Channel ${interaction.commandName === 'lock' ? 'locked' : 'unlocked'}.`);
      }
      case 'role':
      case 'removerole': {
        requireTarget();
        const role = interaction.options.getRole('role');
        if (role.managed || role.id === guild.id) throw new Error('That role cannot be assigned manually.');
        if (role.position >= botMember.roles.highest.position) throw new Error('The bot’s highest role must be above that role.');
        await target.roles[interaction.commandName === 'role' ? 'add' : 'remove'](role, reason);
        return interaction.reply(`${role.name} ${interaction.commandName === 'role' ? 'added to' : 'removed from'} ${target.user.tag}.`);
      }
      default:
        return interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);
    const content = error.code === 50013
      ? 'The bot is missing a required permission or role position.'
      : error.message || 'The command failed. Check the bot’s permissions and try again.';
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content, ephemeral: true });
    }
    return interaction.reply({ content, ephemeral: true });
  }
}

module.exports = { commands, execute };