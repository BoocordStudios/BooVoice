# BooVoice

[![CI](https://github.com/BoocordStudios/BooVoice/actions/workflows/ci.yml/badge.svg)](https://github.com/BoocordStudios/BooVoice/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

BooVoice is a lightweight Discord bot that creates temporary, user-owned voice
channels. A member joins a configured lobby, the bot creates and moves them into
a personal channel, and the channel disappears when it becomes empty.

It uses only the `Guilds` and `GuildVoiceStates` gateway intents; no privileged
intents are required.

## Features

- Per-server setup through the ephemeral `/panel` control panel
- Configurable lobby, destination category, and channel-name template
- Automatic creation, owner assignment, user movement, and empty-channel cleanup
- Owner-only `/limit` and `/rename` commands
- Local JSON persistence with no external database

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- A Discord application with a bot user
- These bot permissions in each server:
  - View Channels
  - Manage Channels
  - Connect
  - Move Members

## Install the bot

1. Create an application in the
   [Discord Developer Portal](https://discord.com/developers/applications), add a
   bot user, and copy its token.
2. In the portal's OAuth2 URL Generator, select the `bot` and
   `applications.commands` scopes, select the permissions listed above, and use
   the generated URL to add the bot to a server.
3. Clone and configure BooVoice:

   ```bash
   git clone https://github.com/BoocordStudios/BooVoice.git
   cd BooVoice
   npm ci
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env` for the final command.

4. Put the token in `.env`:

   ```dotenv
   DISCORD_TOKEN=replace-with-your-bot-token
   ```

5. Start the bot:

   ```bash
   npm start
   ```

Never commit `.env` or share a bot token. If a token is exposed, reset it
immediately in the Developer Portal.

## Configure a server

Run `/panel` as a member with **Manage Server** permission. Choose:

1. The voice channel members join to create a personal channel
2. An optional destination category (otherwise the lobby's category is used)
3. An optional channel-name template

Guild-scoped slash commands are registered automatically when the bot starts or
joins a server.

### Template placeholders

| Placeholder | Value |
| --- | --- |
| `%username` | Discord username |
| `%displayname` | Server display name |
| `%userid` | Discord user ID |
| `%guildname` | Server name |
| `%count` | Current personal-channel sequence number |

Example: `%displayname | %guildname`

### Commands

| Command | Who can use it | Purpose |
| --- | --- | --- |
| `/panel` | Members with Manage Server | Configure AutoVoice for the server |
| `/limit amount:<0-99>` | Personal-channel owner | Set a user limit; `0` means unlimited |
| `/rename name:<text>` | Personal-channel owner | Rename the personal channel |

## Data and privacy

BooVoice stores only the IDs needed for server configuration and temporary
channel ownership in `data/store.json`. It does not read messages, record voice,
or use privileged gateway intents. The runtime data file is ignored by Git; keep
it private because Discord IDs can still identify servers, channels, and users.

## Development

```bash
npm ci
npm run check
npm test
npm audit --omit=dev
```

The test suite uses Node's built-in test runner. CI runs the same checks on the
maintained Node.js 22 and 24 release lines.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
security issues according to [SECURITY.md](SECURITY.md).

## License

BooVoice is available under the [ISC License](LICENSE).
