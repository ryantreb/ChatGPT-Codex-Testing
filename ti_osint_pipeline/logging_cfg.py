"""JSON logging configuration with secret redaction."""

from __future__ import annotations

import json
import logging
import os
from typing import Iterable


class SecretFilter(logging.Filter):
    """Redact known secrets from log records."""

    def __init__(self, secrets: Iterable[str]) -> None:
        super().__init__()
        self.secrets = [s for s in secrets if s]

    def filter(self, record: logging.LogRecord) -> bool:  # pragma: no cover - trivial
        message = str(record.getMessage())
        for secret in self.secrets:
            if secret and secret in message:
                message = message.replace(secret, "[REDACTED]")
        record.msg = message
        return True


class JsonFormatter(logging.Formatter):
    """Output logs as JSON lines."""

    def format(self, record: logging.LogRecord) -> str:  # pragma: no cover - simple
        log_record = {
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name,
        }
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(log_record, ensure_ascii=False)


def configure_logging() -> None:
    """Configure root logger for JSON output."""
    secrets = [
        os.getenv("OPENAI_API_KEY"),
        os.getenv("TWITTER_BEARER"),
        os.getenv("TEAMS_WEBHOOK_URL"),
    ]
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(SecretFilter(secrets))

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)
    root.addHandler(handler)
