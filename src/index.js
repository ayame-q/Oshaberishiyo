import { Client, GatewayIntentBits, Events, ApplicationCommandOptionType, PermissionFlagsBits, ChannelType } from "discord.js";
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
  // ギルドに必要なコマンドが無ければ作成します
  try {
    const commands = await guild.commands.fetch();
    const needed = [
      { name: "set_notify_channel", description: "ボイスチャンネルの入室通知を投稿するチャンネルを設定します", options: [
        { name: "channel", description: "通知を送るテキストチャンネルを選択", type: ApplicationCommandOptionType.Channel, required: false, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] }
      ], default_member_permissions: PermissionFlagsBits.Administrator.toString(), dm_permission: false },
      { name: "get_notify_channel", description: "現在の通知先チャンネルを表示します", default_member_permissions: PermissionFlagsBits.Administrator.toString(), dm_permission: false },
      { name: "clear_notify_channel", description: "通知先チャンネルの設定を削除します", default_member_permissions: PermissionFlagsBits.Administrator.toString(), dm_permission: false },
    ];

    for (const cmd of needed) {
      const existing = commands.find((c) => c.name === cmd.name);
      if (!existing) {
        await guild.commands.create(cmd);
        console.log(`✅ コマンド「${cmd.name}」をサーバー「${guild.name ?? guild.id}」に作成しました（ID: ${guild.id}）`);
      } else {
        // 既存コマンドは権限やオプションを上書きして最新化
        await guild.commands.edit(existing.id, cmd);
        console.log(`🔄 コマンド「${cmd.name}」の設定をサーバー「${guild.name ?? guild.id}」で更新しました（ID: ${guild.id}）`);
      }
    }
  } catch (err) {
    console.error("❌ ギルドコマンドの登録に失敗しました:", err);
  }
}

client.on(Events.GuildCreate, async (guild) => {
  // BOT が新しいギルドに参加したとき、コマンドを登録
  await ensureGuildCommand(guild);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.guild) {
      await interaction.reply({ content: "サーバー内で実行してください", ephemeral: true });
      return;
    }

    const hasManage = interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild) || interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator) || interaction.member?.permissions?.has?.(PermissionFlagsBits.ManageGuild);

    if (interaction.commandName === "set_notify_channel") {
      if (!hasManage) {
        await interaction.reply({ content: "このコマンドを実行する権限がありません（管理者のみ）", ephemeral: true });
        return;
      }

      // チャンネル指定は任意。未指定ならコマンドを実行したチャンネルを使う
      let channel = interaction.options.getChannel("channel");
      if (!channel) {
        channel = interaction.channel;
      }

      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "テキストチャンネルを選んでください", ephemeral: true });
        return;
      }

      // ボットが指定チャンネルに投稿できるか確認
      const botUser = client.user;
      const canSend = channel.permissionsFor?.(botUser)?.has?.(PermissionFlagsBits.SendMessages);
      if (canSend === false) {
        await interaction.reply({ content: "ボットにこのチャンネルへの送信権限がありません。チャンネルの権限を確認してください。", ephemeral: true });
        return;
      }

      // サーバー設定を保存
      try {
        await servers.update(
          { guildId: interaction.guild.id },
          { $set: { guildId: interaction.guild.id, notifyChannelId: channel.id } },
          { upsert: true }
        );
        const saved = await servers.findOne({ guildId: interaction.guild.id });
        console.log(`🔧 通知チャンネルを保存しました: サーバー「${interaction.guild.name ?? interaction.guild.id}」 チャンネル「#${channel.name ?? channel.id}」 (ID: ${channel.id})`, saved);
      } catch (err) {
        console.error("❌ 設定の保存に失敗しました:", err);
        await interaction.reply({ content: "設定の保存に失敗しました", ephemeral: true });
        return;
      }

      await interaction.reply({ content: `${channel} を通知チャンネルに設定しました。`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "get_notify_channel") {
      const cfg = await servers.findOne({ guildId: interaction.guild.id });
      if (!cfg?.notifyChannelId) {
        await interaction.reply({ content: "通知チャンネルは設定されていません。", ephemeral: true });
      } else {
        await interaction.reply({ content: `現在の通知チャンネル: <#${cfg.notifyChannelId}> (ID: ${cfg.notifyChannelId})`, ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === "clear_notify_channel") {
      if (!hasManage) {
        await interaction.reply({ content: "このコマンドを実行する権限がありません（管理者のみ）", ephemeral: true });
        return;
      }
      await servers.remove({ guildId: interaction.guild.id }, { multi: false });
      console.log(`🗑️ 通知チャンネルの設定をクリアしました: サーバー「${interaction.guild.name ?? interaction.guild.id}」 (ID: ${interaction.guild.id})`);
      await interaction.reply({ content: "通知チャンネルの設定をクリアしました。", ephemeral: true });
    }

  } catch (err) {
    console.error("❌ コマンド処理中にエラーが発生しました:", err);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    // userId を確実に取得
    const userId = newState.member?.id ?? oldState.member?.id ?? newState.id ?? oldState.id ?? newState.userId ?? oldState.userId;
    if (!userId) return;

    // guildId を確実に取得
    const guildId = newState.guildId ?? oldState.guildId ?? newState.guild?.id ?? oldState.guild?.id;
    if (!guildId) return;

    const joinedChannelId = newState.channelId;
    const leftChannelId = oldState.channelId;

    console.log(`🔔 ボイス状態更新: ユーザーID=${userId} サーバーID=${guildId} 入室=${joinedChannelId ?? 'なし'} 退室=${leftChannelId ?? 'なし'}`);

    // 退室時刻を記録
    if (leftChannelId && !joinedChannelId) {
      await entries.update(
        { userId, guildId },
        { $set: { userId, guildId, lastLeave: Date.now() } },
        { upsert: true }
      );
      console.log(`⏱️ 退室時刻を記録しました: ユーザーID=${userId} サーバーID=${guildId} チャンネルID=${leftChannelId}`);
    }

    // 入室時の通知（未接続 -> 接続）
    if (!leftChannelId && joinedChannelId) {
      const lastEntry = await entries.findOne({ userId, guildId });
      const lastLeaveTime = lastEntry?.lastLeave ?? 0;

      if (lastLeaveTime && Date.now() - lastLeaveTime < FIVE_MINUTES) {
        // 退室から5分以内 → 通知しない
        console.log(`⏭️ 通知をスキップしました（直近に退室しています）: ユーザーID=${userId} 経過=${Date.now() - lastLeaveTime}ms`);
        return;
      }

      // サーバーごとの通知先を取得
      const serverConfig = await servers.findOne({ guildId });
      const notifyChannelId = serverConfig?.notifyChannelId;
      console.log(`🔎 サーバー設定を取得しました: サーバーID=${guildId}`, serverConfig);
      if (!notifyChannelId) {
        // 設定されていなければ通知しない
        console.log(`⚠️ 通知チャンネルが設定されていません: サーバーID=${guildId}`);
        return;
      }

      // guild と参加チャンネルを確実に取得
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        console.error(`❌ サーバー情報を取得できませんでした: サーバーID=${guildId}`);
        return;
      }

      const joinedChannel = newState.channel ?? (await guild.channels.fetch(joinedChannelId).catch(() => null));

      const member = await guild.members.fetch(userId).catch(() => null);
      const displayName = member?.displayName ?? (await client.users.fetch(userId).then(u => u.username).catch(() => "Unknown"));

      const channelName = joinedChannel?.name ?? `(#${joinedChannelId})`;
      const message = `${displayName} さん (<@${userId}>) が ${channelName} に参加しました！`;

      console.log(`✉️ 通知を送信します: サーバー「${guild.name ?? guildId}」 チャンネル「${joinedChannel?.name ?? notifyChannelId}」 (通知先ID: ${notifyChannelId}) メッセージ: ${message}`);

      const notifyChannel = await guild.channels.fetch(notifyChannelId).catch(() => null);

      if (notifyChannel && notifyChannel.isTextBased()) {
        await notifyChannel.send(message).catch((e) => console.error("Failed to send notify message:", e));
      } else {
        console.error("❌ 通知チャンネルが見つからないか、テキストチャンネルではありません");
      }
    }
  } catch (err) {
    console.error("❌ VoiceStateUpdate の処理中にエラーが発生しました:", err);
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ ログインしました: ${client.user.tag} (ID: ${client.user.id})`);

  // 起動時に既に参加しているギルドへコマンドを登録
  for (const guild of client.guilds.cache.values()) {
    await ensureGuildCommand(guild).catch((e) => console.error(e));
  }
});

client.login(TOKEN);
