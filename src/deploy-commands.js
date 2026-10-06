const { REST, Routes } = require('discord.js');
const config = require('./config');
const { commands } = require('./commands');

const rest = new REST({ version: '10' }).setToken(config.token);

rest.put(
  Routes.applicationGuildCommands(config.clientId, config.guildId),
  { body: commands.map((command) => command.toJSON()) },
).then(() => {
  console.log(`Deployed ${commands.length} commands to guild ${config.guildId}.`);
}).catch((error) => {
  console.error('Could not deploy slash commands:', error);
  process.exitCode = 1;
});