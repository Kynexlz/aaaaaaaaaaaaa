const { Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const temporaryBans = require('./temporary-bans');
const { execute } = require('./commands');
const { createHealthServer } = require('./health-server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)(?:\/[a-z0-9-]*)?/i;
const server = createHealthServer(() => client.isReady());
const port = Number(process.env.PORT) || 3000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Health server listening on port ${port}`);
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}`);
  try {
    await temporaryBans.load();
    await temporaryBans.expireDueBans(client);
  } catch (error) {
    console.error('Could not load temporary bans:', error);
  }
  setInterval(() => temporaryBans.expireDueBans(client).catch(console.error), 30_000);
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

client.on(Events.ShardError, (error, shardId) => {
  console.error(`Discord gateway error on shard ${shardId}:`, error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) await execute(interaction, temporaryBans);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!config.welcomeChannelId) return;
  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send(`Welcome ${member} to **${member.guild.name}**!`).catch(console.error);
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!config.boostChannelId || oldMember.premiumSince || !newMember.premiumSince) return;
  const channel = await newMember.guild.channels.fetch(config.boostChannelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send(`Thank you ${newMember} for boosting **${newMember.guild.name}**!`).catch(console.error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;
  if (!invitePattern.test(message.content)) return;
  try {
    await message.delete();
    await message.channel.send({
      content: `${message.author}, server invites are not allowed.`,
      allowedMentions: { users: [message.author.id] },
    }).then((notice) => setTimeout(() => notice.delete().catch(() => {}), 5_000));
  } catch (error) {
    console.error(`Could not remove invite from ${message.author.tag}:`, error);
  }
});

client.login(config.token).catch((error) => {
  console.error('Discord login failed:', error);
  process.exitCode = 1;
  server.close(() => client.destroy());
});

function shutdown() {
  server.close();
  client.destroy();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);