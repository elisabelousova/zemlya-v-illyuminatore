import os

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]

# Telegram user IDs that are allowed to use the bot (so strangers can't upload to your channel)
ALLOWED_USERS = [int(uid) for uid in os.environ.get("ALLOWED_USERS", "").split(",") if uid]

YOUTUBE_CLIENT_SECRETS_FILE = os.environ.get("YOUTUBE_CLIENT_SECRETS_FILE", "client_secret.json")
YOUTUBE_TOKEN_FILE = os.environ.get("YOUTUBE_TOKEN_FILE", "youtube_token.json")

# Default YouTube upload settings
YOUTUBE_CATEGORY_ID = "22"  # People & Blogs
YOUTUBE_PRIVACY = os.environ.get("YOUTUBE_PRIVACY", "public")
