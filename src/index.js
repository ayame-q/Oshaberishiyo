import { Client, GatewayIntentBits, Events, ApplicationCommandOptionType } from "discord.js";
import { entries, servers } from "./db.js";

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const FIVE_MINUTES = 5 * 60 * 1000;

async function ensureGuildCommand(guild) {
  // ギルドに /set_notify_channel コマンドが無ければ作成します
  try {
    const commands = await guild.commands.fetch();
    const name = "set_notify_channel";
    if (!commands.some((c) => c.name === name)) {
      await guild.commands.create({
        name,
        description: "このサーバーの通知を投稿するチャンネルを設定します",
        options: [
          {
            name: "channel",
            description: "通知を送るテキストチャンネルを選択してください",
            type: ApplicationCommandOptionType.Channel, // チャンネル型
            required: true,
          },
        ],
      });
      console.log(`✅ Created command ${name} for guild ${guild.id}`);
    }
  } catch (err) {
    console.error("Failed to ensure guild command:", err);
  }
}

client.on(Events.GuildCreate, async (guild) => {
  // BOT が新しいギルドに参加したとき、コマンドを登録
  await ensureGuildCommand(guild);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "set_notify_channel") {
      if (!interaction.guild) {
        await interaction.reply({ content: "サーバー内で実行してください", ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel("channel");
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "テキストチャンネルを選んでください", ephemeral: true });
        return;
      }

      // サーバー設定を保存
      await servers.update(
        { guildId: interaction.guild.id },
        { $set: { guildId: interaction.guild.id, notifyChannelId: channel.id } },
        { upsert: true }
      );

      await interaction.reply({ content: `${channel} を通知チャンネルに設定しました。`, ephemeral: true });
    }
  } catch (err) {
    console.error("Interaction handling error:", err);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const user = newState.member?.user || oldState.member?.user;
    if (!user) return;

    const joinedChannel = newState.channel;
    const leftChannel = oldState.channel;

    // ギルドID を取得（ステートのどちらかから取得）
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!guildId) return;

    // 退室時刻を記録
    if (leftChannel && !joinedChannel) {
      await entries.update(
        { userId: user.id, guildId },
        { $set: { userId: user.id, guildId, lastLeave: Date.now() } },
        { upsert: true }
      );
    }

    // 入室時の通知
    if (!leftChannel && joinedChannel) {
      const lastEntry = await entries.findOne({ userId: user.id, guildId });
      const lastLeaveTime = lastEntry?.lastLeave ?? 0;

      if (lastLeaveTime && Date.now() - lastLeaveTime < FIVE_MINUTES) {
        // 退室から5分以内 → 通知しない
        return;
      }

      // サーバーごとの通知先を取得
      const serverConfig = await servers.findOne({ guildId });
      const notifyChannelId = serverConfig?.notifyChannelId;
      if (!notifyChannelId) {
        // 設定されていなければ通知しない
        console.log(`通知チャンネルが設定されていません: guild ${guildId}`);
        return;
      }

      const channelName = joinedChannel.name;
      const displayName = user.globalName ?? user.username;
      const message = `${displayName} さん (<@${user.id}>) が ${channelName} に参加しました！`;

      const guild = await client.guilds.fetch(guildId);
      const notifyChannel = await guild.channels.fetch(notifyChannelId).catch(() => null);

      if (notifyChannel && notifyChannel.isTextBased()) {
        await notifyChannel.send(message);
      } else {
        console.error("❌ 通知チャンネルが見つからないか、テキストチャンネルではありません");
      }
    }
  } catch (err) {
    console.error("Error on VoiceStateUpdate:", err);
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // 起動時に既に参加しているギルドへコマンドを登録
  for (const [id, guild] of client.guilds.cache) {
    await ensureGuildCommand(guild).catch((e) => console.error(e));
  }
});

client.login(TOKEN);
