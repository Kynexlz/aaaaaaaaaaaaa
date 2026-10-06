const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', 'data');
const dataPath = path.join(dataDirectory, 'temporary-bans.json');
let scheduledBans = new Map();

async function save() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify([...scheduledBans]), 'utf8');
  await fs.rename(temporaryPath, dataPath);
}

async function load() {
  try {
    scheduledBans = new Map(JSON.parse(await fs.readFile(dataPath, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function schedule(guildId, userId, expiresAt) {
  scheduledBans.set(`${guildId}:${userId}`, { guildId, userId, expiresAt });
  await save();
}

async function cancel(guildId, userId) {
  scheduledBans.delete(`${guildId}:${userId}`);
  await save();
}

async function expireDueBans(client) {
  const now = Date.now();
  let changed = false;

  for (const [key, ban] of scheduledBans) {
    if (ban.expiresAt > now) continue;

    try {
      const guild = await client.guilds.fetch(ban.guildId);
      await guild.bans.remove(ban.userId, 'Temporary ban expired');
    } catch (error) {
      if (error.code !== 10026 && error.code !== 10013) {
        console.error(`Could not expire temporary ban for ${ban.userId}:`, error);
        continue;
      }
    }

    scheduledBans.delete(key);
    changed = true;
  }

  if (changed) await save();
}

module.exports = { cancel, expireDueBans, load, schedule };