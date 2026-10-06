# Orbit Discord Bot

Administrator-only slash moderation commands, welcome and boost messages, temporary bans, and an automatic server-invite filter.

## Setup

1. Install Node.js 20 or later.
2. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
3. Enable the **Server Members Intent** and **Message Content Intent** on the bot's page. Invite the bot with `bot` and `applications.commands` scopes and the moderation, message management, and channel permission-overwrite permissions it needs.
4. Create `.env` with `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `WELCOME_CHANNEL_ID`, and `BOOST_CHANNEL_ID`.
5. Run `npm install`, then `npm run deploy` to register the guild slash commands.
6. Run `npm start` to start the bot.

The `.env` file contains a secret token and is excluded from Git. Do not share or commit it.

## Deploy to Render

1. Push this project to a GitHub repository and create a new Blueprint on Render from that repository. Render will read `render.yaml`.
2. Enter values for `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `WELCOME_CHANNEL_ID`, and `BOOST_CHANNEL_ID` when prompted. These are private service environment variables and should not be committed.
3. Deploy the Blueprint. Render runs `npm install` and `npm start`, and checks `/healthz`.

The Blueprint uses a paid always-on Starter web service and a 1 GB persistent disk mounted at the temporary-ban data directory. The disk preserves scheduled unbans across restarts; a free service without persistent storage could sleep or lose those records.

## Commands

All commands are registered for server use and restricted to members with the Administrator permission. The bot also checks this permission when executing each command.

- `/ban user reason`
- `/timeban user duration reason` (duration examples: `30m`, `2h`, `3d`, `1w`)
- `/unban user_id`
- `/kick user reason`
- `/timeout user` (five minutes)
- `/untimeout user`
- `/purge amount` (1-100 recent messages; messages older than 14 days are skipped)
- `/lock` and `/unlock`
- `/role user role` and `/removerole user role`

Temporary-ban expiration times are stored in `data/temporary-bans.json` and survive restarts. Keep the `data` directory between deployments.

The invite filter removes `discord.gg`, `discord.com/invite`, and `discordapp.com/invite` links from all non-bot messages. Welcome and boost announcements use the configured channel IDs; set either ID to an empty value to disable that announcement.