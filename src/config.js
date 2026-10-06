require('dotenv').config();

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
  boostChannelId: process.env.BOOST_CHANNEL_ID,
};