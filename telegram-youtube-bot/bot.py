import logging
import os
import tempfile
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from config import TELEGRAM_BOT_TOKEN, ALLOWED_USERS
from youtube_uploader import upload_to_youtube

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def is_allowed(user_id: int) -> bool:
    return not ALLOWED_USERS or user_id in ALLOWED_USERS


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Привет! Отправь мне видео, и я загружу его в YouTube Shorts.\n\n"
        "Добавь подпись к видео — она станет заголовком.\n"
        "Хештеги из подписи пойдут в теги."
    )


async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        await update.message.reply_text("У тебя нет доступа к этому боту.")
        return

    video = update.message.video or update.message.document
    if not video:
        return

    caption = update.message.caption or ""
    tags = [t.strip("#") for t in caption.split() if t.startswith("#")]
    title = " ".join(w for w in caption.split() if not w.startswith("#")).strip()
    if not title:
        title = "Short video"

    msg = await update.message.reply_text("⏳ Скачиваю видео...")

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        file = await video.get_file()
        await file.download_to_drive(tmp_path)

        await msg.edit_text("📤 Загружаю в YouTube Shorts...")
        url = upload_to_youtube(tmp_path, title, description=caption, tags=tags)
        await msg.edit_text(f"✅ Готово!\n{url}")
    except Exception as e:
        logger.exception("Upload failed")
        await msg.edit_text(f"❌ Ошибка: {e}")
    finally:
        os.unlink(tmp_path)


def main():
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.VIDEO | filters.Document.VIDEO, handle_video))

    logger.info("Bot started")
    app.run_polling()


if __name__ == "__main__":
    main()
