import os
import json
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from config import YOUTUBE_CLIENT_SECRETS_FILE, YOUTUBE_TOKEN_FILE, YOUTUBE_CATEGORY_ID, YOUTUBE_PRIVACY

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def get_youtube_service():
    creds = None
    if os.path.exists(YOUTUBE_TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(YOUTUBE_TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(YOUTUBE_CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=8080)
        with open(YOUTUBE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def upload_to_youtube(file_path: str, title: str, description: str = "", tags: list[str] | None = None) -> str:
    youtube = get_youtube_service()

    body = {
        "snippet": {
            "title": title,
            "description": description + "\n#Shorts",
            "tags": tags or [],
            "categoryId": YOUTUBE_CATEGORY_ID,
        },
        "status": {
            "privacyStatus": YOUTUBE_PRIVACY,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(file_path, mimetype="video/mp4", resumable=True, chunksize=10 * 1024 * 1024)

    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    return f"https://youtube.com/shorts/{video_id}"
