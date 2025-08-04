"""Minimal openai stub for testing."""

from __future__ import annotations


api_key = None  # placeholder for attribute access


class ChatCompletion:
    @staticmethod
    async def acreate(**kwargs):  # pragma: no cover - replaced in tests
        return {"choices": [{"message": {"content": "{}"}}]}
