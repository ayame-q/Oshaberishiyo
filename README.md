# おしゃべりしよ〜

おしゃべりしよ〜は、Discordのチャット入室を通知する単純なBotです。
チャットにユーザーが入室したときに、指定したチャンネルに通知します。

## 機能
- ユーザーがチャットに入室したときに通知
- 5分以内に再入室した場合は通知しない

## .envファイルの設定
以下の環境変数を設定してください。
```dotenv
DISCORD_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_server_id
NOTIFY_CHANNEL_ID=your_notification_channel_id
```

## 必要な権限
Botに以下の権限を付与してください。
- OAuth2
  - Bot

- Bot Permissions
  - View Channels
  - Send Messages
  - Connect
  - Speak
  - Use Voice Activity

## 動作方法
docker-composeを使用して起動します。

```bash
docker-compose up -d --build
```

本番環境で使用する場合は、`docker-compose.prod.yml`を使用してください。

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build 
```

## ライセンス
MIT License
