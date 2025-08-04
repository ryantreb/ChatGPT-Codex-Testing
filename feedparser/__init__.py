"""Minimal feedparser stub."""

from __future__ import annotations

from types import SimpleNamespace


def parse(text: str):
    return SimpleNamespace(entries=[])
