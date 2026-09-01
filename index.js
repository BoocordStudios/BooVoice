require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { DEFAULT_TEMPLATE, applyTemplate } = require('./src/template');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('DISCORD_TOKEN is missing from the .env file.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const BOT_BRAND = 'Boo Voice';
const EMBED_COLORS = {
  primary: 0x0f766e,
  info: 0x2563eb,
  success: 0x16a34a,
  error: 0xdc2626,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  ensureDataDir();
  const initialData = { guilds: {}, ownedChannels: {} };

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const normalizedRaw = raw.replace(/^\uFEFF/, '').trim();
    if (!normalizedRaw) {
      fs.writeFileSync(STORE_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }

    const parsed = JSON.parse(normalizedRaw);

    return {
      guilds: parsed.guilds ?? {},
      ownedChannels: parsed.ownedChannels ?? {},
    };
  } catch (error) {
    console.error('Could not read data/store.json. Using an empty store.', error);
    fs.writeFileSync(STORE_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

const store = loadStore();
let saveTimer = null;

function saveStoreNow() {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveStoreNow();
  }, 150);
}

function getGuildConfig(guildId) {
  if (!store.guilds[guildId]) {
    store.guilds[guildId] = {
      autoVoiceChannelId: null,
      targetCategoryId: null,
      nameTemplate: DEFAULT_TEMPLATE,
    };
    scheduleSave();
  }

  if (!Object.prototype.hasOwnProperty.call(store.guilds[guildId], 'targetCategoryId')) {
    store.guilds[guildId].targetCategoryId = null;
    scheduleSave();
  }

  return store.guilds[guildId];
}

function countOwnedChannelsInGuild(guildId) {
  let count = 0;
  for (const info of Object.values(store.ownedChannels)) {
    if (info.guildId === guildId) {
      count += 1;
    }
  }
  return count;
}

function hasGuildManagePermission(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

function buildStatusEmbed(guild, type, title, description) {
  const color = EMBED_COLORS[type] ?? EMBED_COLORS.info;
  const footer = guild?.name ? `${BOT_BRAND} | ${guild.name}` : BOT_BRAND;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footer })
    .setTimestamp();
}

function buildPanelEmbed(guild, config) {
  const autoVoiceDisplay = config.autoVoiceChannelId
    ? `<#${config.autoVoiceChannelId}>`
    : 'Not set';
  const categoryDisplay = config.targetCategoryId
    ? `<#${config.targetCategoryId}>`
    : 'Same as the join channel category';

  return buildStatusEmbed(
    guild,
    'primary',
    'Control Panel',
    'Manage the AutoVoice join channel, target category, and channel name template for this server.',
  )
    .addFields(
      { name: 'Join Channel', value: autoVoiceDisplay, inline: false },
      { name: 'Target Category', value: categoryDisplay, inline: false },
      { name: 'Name Template', value: `\`${config.nameTemplate || DEFAULT_TEMPLATE}\``, inline: false },
      {
        name: 'Placeholders',
        value: '`%username`, `%displayname`, `%userid`, `%guildname`, `%count`',
        inline: false,
      },
    );
}

function buildPanelComponents(config) {
  const lobbySelectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:selectLobby')
      .setPlaceholder('Select an AutoVoice join channel')
      .setChannelTypes(ChannelType.GuildVoice)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const categorySelectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('panel:selectCategory')
      .setPlaceholder('Select a target category')
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:setTemplate')
      .setLabel('Edit Template')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel:clearCategory')
      .setLabel('Reset Category')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!config.targetCategoryId),
    new ButtonBuilder()
      .setCustomId('panel:disableAutoVoice')
      .setLabel('Disable AutoVoice')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!config.autoVoiceChannelId),
  );

  return [lobbySelectRow, categorySelectRow, buttonRow];
}

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Opens the Boo Voice configuration panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('limit')
    .setDescription('Sets the user limit for your own AutoVoice channel.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('0 = unlimited, otherwise 1-99')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(99),
    ),
  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Changes the name of your own AutoVoice channel.')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('New channel name (1-100 characters)')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(100),
    ),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

async function registerCommandsForGuild(guild) {
  await guild.commands.set(commands);
}

async function registerCommandsForAllGuilds() {
  const tasks = [];
  for (const guild of client.guilds.cache.values()) {
    tasks.push(registerCommandsForGuild(guild));
  }

  await Promise.allSettled(tasks);
}

async function maybeDeleteOwnedChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    return;
  }

  const ownership = store.ownedChannels[channel.id];
  if (!ownership) {
    return;
  }

  if (channel.members.size > 0) {
    return;
  }

  delete store.ownedChannels[channel.id];
  scheduleSave();

  try {
    await channel.delete('AutoVoice channel is empty');
  } catch (error) {
    console.error(`Could not delete voice channel ${channel.id}.`, error);
  }
}

async function createOwnedVoiceChannelFromLobby(voiceState) {
  const config = getGuildConfig(voiceState.guild.id);
  const lobby = voiceState.channel;

  if (!lobby || lobby.id !== config.autoVoiceChannelId) {
    return;
  }

  const context = {
    username: voiceState.member.user.username,
    displayName: voiceState.member.displayName,
    userId: voiceState.member.id,
    guildName: voiceState.guild.name,
    count: countOwnedChannelsInGuild(voiceState.guild.id) + 1,
  };

  const name = applyTemplate(config.nameTemplate || DEFAULT_TEMPLATE, context);

  let parentId = lobby.parentId ?? null;
  if (config.targetCategoryId) {
    const fetchedCategory = await voiceState.guild.channels.fetch(config.targetCategoryId).catch(() => null);
    if (fetchedCategory?.type === ChannelType.GuildCategory) {
      parentId = fetchedCategory.id;
    } else {
      config.targetCategoryId = null;
      scheduleSave();
    }
  }

  const created = await voiceState.guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: parentId,
    bitrate: lobby.bitrate,
    userLimit: 0,
    permissionOverwrites: lobby.permissionOverwrites.cache.map((overwrite) => ({
      id: overwrite.id,
      allow: overwrite.allow.bitfield,
      deny: overwrite.deny.bitfield,
      type: overwrite.type,
    })),
  });

  store.ownedChannels[created.id] = {
    guildId: voiceState.guild.id,
    ownerId: voiceState.member.id,
  };
  scheduleSave();

  try {
    await voiceState.setChannel(created, 'AutoVoice: personal channel created');
  } catch (error) {
    console.error('Could not move the user to the new voice channel.', error);

    if (created.members.size === 0) {
      await created.delete('Rollback after failed move').catch(() => null);
      delete store.ownedChannels[created.id];
      scheduleSave();
    }
  }
}

async function cleanupOwnedChannelStore() {
  const toDelete = [];

  for (const channelId of Object.keys(store.ownedChannels)) {
    const fetched = await client.channels.fetch(channelId).catch(() => null);

    if (!fetched || fetched.type !== ChannelType.GuildVoice) {
      toDelete.push(channelId);
      continue;
    }

    if (fetched.members.size === 0) {
      await fetched.delete('Cleaning up an empty AutoVoice channel after restart').catch(() => null);
      toDelete.push(channelId);
    }
  }

  if (toDelete.length > 0) {
    for (const channelId of toDelete) {
      delete store.ownedChannels[channelId];
    }
    scheduleSave();
  }
}

async function cleanupGuildConfigsOnStartup() {
  let changed = false;

  for (const [guildId, config] of Object.entries(store.guilds)) {
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      delete store.guilds[guildId];
      changed = true;
      continue;
    }

    if (config.autoVoiceChannelId) {
      const autoVoiceChannel = await guild.channels.fetch(config.autoVoiceChannelId).catch(() => null);
      const isValidVoiceChannel =
        autoVoiceChannel?.type === ChannelType.GuildVoice && autoVoiceChannel.guildId === guildId;

      if (!isValidVoiceChannel) {
        config.autoVoiceChannelId = null;
        changed = true;
      }
    }

    if (config.targetCategoryId) {
      const targetCategory = await guild.channels.fetch(config.targetCategoryId).catch(() => null);
      const isValidCategory =
        targetCategory?.type === ChannelType.GuildCategory && targetCategory.guildId === guildId;

      if (!isValidCategory) {
        config.targetCategoryId = null;
        changed = true;
      }
    }
  }

  if (changed) {
    scheduleSave();
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await registerCommandsForAllGuilds();
  await cleanupGuildConfigsOnStartup();
  await cleanupOwnedChannelStore();

  console.log('Slash commands registered.');
});

client.on(Events.GuildCreate, async (guild) => {
  await registerCommandsForGuild(guild).catch((error) => {
    console.error(`Could not register commands in guild ${guild.id}.`, error);
  });
});

client.on(Events.ChannelDelete, (channel) => {
  if (store.ownedChannels[channel.id]) {
    delete store.ownedChannels[channel.id];
    scheduleSave();
  }

  for (const config of Object.values(store.guilds)) {
    if (config.autoVoiceChannelId === channel.id) {
      config.autoVoiceChannelId = null;
      scheduleSave();
    }
    if (config.targetCategoryId === channel.id) {
      config.targetCategoryId = null;
      scheduleSave();
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.member?.user.bot) {
    return;
  }

  if (newState.channelId && newState.channelId !== oldState.channelId) {
    await createOwnedVoiceChannelFromLobby(newState).catch((error) => {
      console.error('Error while creating an AutoVoice channel.', error);
    });
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await maybeDeleteOwnedChannel(oldState.channel).catch((error) => {
      console.error('Error while cleaning up an AutoVoice channel.', error);
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        const config = getGuildConfig(interaction.guildId);
        await interaction.reply({
          embeds: [buildPanelEmbed(interaction.guild, config)],
          components: buildPanelComponents(config),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.commandName === 'limit') {
        const amount = interaction.options.getInteger('amount', true);
        const memberVoice = interaction.member?.voice;

        if (!memberVoice?.channel) {
          await interaction.reply({
            embeds: [
              buildStatusEmbed(
                interaction.guild,
                'error',
                'Cannot Set Limit',
                'You must be in your own AutoVoice channel to set a user limit.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const channel = memberVoice.channel;
        const ownership = store.ownedChannels[channel.id];

        if (!ownership || ownership.ownerId !== interaction.user.id) {
          await interaction.reply({
            embeds: [
              buildStatusEmbed(
                interaction.guild,
                'error',
                'Permission Denied',
                'Only the owner of this AutoVoice channel can change its user limit.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await channel.setUserLimit(amount, `User limit set by ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'success',
              'User Limit Updated',
              amount === 0
                ? 'The user limit has been removed. The channel is now unlimited.'
                : `The user limit has been set to ${amount}.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.commandName === 'rename') {
        const requestedName = interaction.options.getString('name', true).trim();
        const memberVoice = interaction.member?.voice;

        if (!requestedName) {
          await interaction.reply({
            embeds: [
              buildStatusEmbed(
                interaction.guild,
                'error',
                'Invalid Name',
                'The new channel name cannot be empty.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!memberVoice?.channel) {
          await interaction.reply({
            embeds: [
              buildStatusEmbed(
                interaction.guild,
                'error',
                'Cannot Rename Channel',
                'You must be in your own AutoVoice channel to rename it.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const channel = memberVoice.channel;
        const ownership = store.ownedChannels[channel.id];

        if (!ownership || ownership.ownerId !== interaction.user.id) {
          await interaction.reply({
            embeds: [
              buildStatusEmbed(
                interaction.guild,
                'error',
                'Permission Denied',
                'Only the owner of this AutoVoice channel can change its name.',
              ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await channel.setName(requestedName, `Channel renamed by ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'success',
              'Channel Renamed',
              `New name: \`${requestedName}\``,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      return;
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'panel:selectLobby') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedChannelId = interaction.values[0];
      const config = getGuildConfig(interaction.guildId);

      config.autoVoiceChannelId = selectedChannelId;
      if (!config.nameTemplate) {
        config.nameTemplate = DEFAULT_TEMPLATE;
      }
      scheduleSave();

      await interaction.update({
        embeds: [buildPanelEmbed(interaction.guild, config)],
        components: buildPanelComponents(config),
      });
      return;
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'panel:selectCategory') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedCategoryId = interaction.values[0];
      const config = getGuildConfig(interaction.guildId);

      config.targetCategoryId = selectedCategoryId;
      scheduleSave();

      await interaction.update({
        embeds: [buildPanelEmbed(interaction.guild, config)],
        components: buildPanelComponents(config),
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'panel:clearCategory') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const config = getGuildConfig(interaction.guildId);
      config.targetCategoryId = null;
      scheduleSave();

      await interaction.update({
        embeds: [buildPanelEmbed(interaction.guild, config)],
        components: buildPanelComponents(config),
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'panel:disableAutoVoice') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const config = getGuildConfig(interaction.guildId);
      config.autoVoiceChannelId = null;
      scheduleSave();

      await interaction.update({
        embeds: [buildPanelEmbed(interaction.guild, config)],
        components: buildPanelComponents(config),
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'panel:setTemplate') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const config = getGuildConfig(interaction.guildId);

      const modal = new ModalBuilder().setCustomId('panel:templateModal').setTitle('Boo Voice Template');

      const input = new TextInputBuilder()
        .setCustomId('templateInput')
        .setLabel('Template with placeholders')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(100)
        .setValue(config.nameTemplate || DEFAULT_TEMPLATE)
        .setPlaceholder("%username's Channel");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'panel:templateModal') {
      if (!hasGuildManagePermission(interaction)) {
        await interaction.reply({
          embeds: [
            buildStatusEmbed(
              interaction.guild,
              'error',
              'Permission Denied',
              'You need the "Manage Server" permission to configure the panel.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const template = interaction.fields.getTextInputValue('templateInput').trim();
      const config = getGuildConfig(interaction.guildId);

      config.nameTemplate = template || DEFAULT_TEMPLATE;
      scheduleSave();

      await interaction.reply({
        embeds: [
          buildStatusEmbed(
            interaction.guild,
            'success',
            'Template Saved',
            `Active template: \`${config.nameTemplate}\``,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Error in InteractionCreate:', error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        embeds: [
          buildStatusEmbed(
            interaction.guild,
            'error',
            'Internal Error',
            'The request could not be processed. Please try again.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
      return;
    }

    await interaction.reply({
      embeds: [
        buildStatusEmbed(
          interaction.guild,
          'error',
          'Internal Error',
          'The request could not be processed. Please try again.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }
});

process.on('SIGINT', () => {
  saveStoreNow();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveStoreNow();
  process.exit(0);
});

client.login(TOKEN);
