"""Stub aiohttp module for tests without network."""

from __future__ import annotations


class ClientTimeout:
    def __init__(self, total=None):
        self.total = total


class ClientSession:
    def __init__(self, timeout=None):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    # Placeholder methods; real behavior is mocked in tests.
    def get(self, *args, **kwargs):  # pragma: no cover - not used
        raise NotImplementedError

    def post(self, *args, **kwargs):  # pragma: no cover - not used
        raise NotImplementedError
