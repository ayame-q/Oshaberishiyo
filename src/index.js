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

    // 入室時のみ処理
    if (!leftChannel && joinedChannel) {
      const lastEntry = await db.findOne({ userId: user.id });

      if (lastEntry && Date.now() - lastEntry.lastJoin < FIVE_MINUTES) {
        // 5分以内の再入室は無視
        return;
      }

      await db.update(
        { userId: user.id },
        { $set: { userId: user.id, lastJoin: Date.now() } },
        { upsert: true }
      );

      const channelName = joinedChannel.name;
      const message = `「@${user.username}」さんが ${channelName} に参加しました！`;

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
