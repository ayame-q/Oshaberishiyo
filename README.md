# おしゃべりしよ〜

おしゃべりしよ〜は、Discordのチャット入室を通知する単純なBotです。
チャットにユーザーが入室したときに、指定したチャンネルに通知します。

## 機能
- ユーザーがボイスチャンネルに入室したときに通知
- 5分以内に再入室した場合は通知しない
- サーバーごとに通知先チャンネルをスラッシュコマンドで設定

## .envファイルの設定
以下の環境変数を設定してください。

```dotenv
DISCORD_TOKEN=your_discord_bot_token
```

## 必要な権限
Botに以下の権限を付与してください。
- OAuth2
  - Bot
  - applications.commands

- Bot Permissions
  - General Permissions
    - View Channels
  - Text Permissions
    - Send Messages
  - Voice Permissions
    - Use Voice Activity

## スラッシュコマンド
Bot は以下のスラッシュコマンドを自動登録します。

- /set_notify_channel channel: このサーバーの通知先テキストチャンネルを設定（管理者権限が必要）
- /get_notify_channel: 現在の通知先チャンネルを表示
- /clear_notify_channel: 設定をクリア（管理者権限が必要）

## 動作方法
docker-composeを使用して起動します。
```bash
docker-compose up -d --build
```

本番環境で使用する場合は、`docker-compose.prod.yml`を使用してください。

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```


## トラブルシュート
- 通知が来ない:
  - `/get_notify_channel` で通知先が設定されているか確認する
  - 通知先チャンネルで Bot に Send Messages 権限があるか確認する
  - Bot が該当ギルドに参加しているか確認する

- スラッシュコマンドが表示されない:
  - Bot がギルドに参加してからコマンドが登録されるまで数分かかる場合があります
  - 招待時に `applications.commands` スコープを付与しているか確認する

## ライセンス
MIT License
