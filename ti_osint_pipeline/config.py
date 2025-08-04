"""Configuration management for the pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from getpass import getpass

from dotenv import load_dotenv


@dataclass
class Config:
    """Validated configuration values."""

    openai_api_key: str
    twitter_bearer: str
    teams_webhook_url: str
    share_path: Path

    @classmethod
    def load(cls) -> "Config":
        """Load configuration from environment variables."""
        load_dotenv()

        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            openai_api_key = getpass("Enter OPENAI_API_KEY: ").strip()
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY is required")

        twitter_bearer = os.getenv("TWITTER_BEARER")
        if not twitter_bearer:
            twitter_bearer = getpass("Enter TWITTER_BEARER: ").strip()
        if not twitter_bearer:
            raise ValueError("TWITTER_BEARER is required")

        teams_webhook_url = os.getenv("TEAMS_WEBHOOK_URL")
        if not teams_webhook_url:
            teams_webhook_url = getpass("Enter TEAMS_WEBHOOK_URL: ").strip()
        if not teams_webhook_url or not teams_webhook_url.startswith("https://"):
            raise ValueError("TEAMS_WEBHOOK_URL must start with https://")

        share_path = os.getenv("SHARE_PATH")
        if not share_path:
            raise ValueError("SHARE_PATH is required")

        path = Path(share_path).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        if not os.access(path, os.W_OK):
            raise ValueError("SHARE_PATH is not writable")

        return cls(
            openai_api_key=openai_api_key,
            twitter_bearer=twitter_bearer,
            teams_webhook_url=teams_webhook_url,
            share_path=path,
        )
