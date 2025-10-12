import { Client, GatewayIntentBits, Events } from "discord.js";
import db from "./db.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const FIVE_MINUTES = 5 * 60 * 1000;

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const user = newState.member?.user;
    if (!user) return;

    const joinedChannel = newState.channel;
    const leftChannel = oldState.channel;

    // 退室時刻を記録
    if (leftChannel && !joinedChannel) {
      await db.update(
        { userId: user.id },
        { $set: { userId: user.id, lastLeave: Date.now() } },
        { upsert: true }
      );
    }

    // 入室時の通知
    if (!leftChannel && joinedChannel) {
      const lastEntry = await db.findOne({ userId: user.id });
      const lastLeaveTime = lastEntry?.lastLeave ?? 0;

      if (lastLeaveTime && Date.now() - lastLeaveTime < FIVE_MINUTES) {
        // 退室から5分以内 → 通知しない
        return;
      }

      const channelName = joinedChannel.name;
      const message = `${user.globalName} さん (<@${user.id}>) が ${channelName} に参加しました！`;

      const guild = await client.guilds.fetch(GUILD_ID);
      const notifyChannel = await guild.channels.fetch(NOTIFY_CHANNEL_ID);

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

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
