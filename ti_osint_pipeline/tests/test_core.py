import asyncio
import json
from pathlib import Path
import sys
from pathlib import Path as P

import pytest

sys.path.append(str(P(__file__).resolve().parents[2]))
from ti_osint_pipeline.config import Config
from ti_osint_pipeline import core


class DummyResponse:
    def __init__(self, data, *, is_text=False):
        self.data = data
        self.is_text = is_text

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def raise_for_status(self):
        return None

    async def json(self):
        return self.data

    async def text(self):
        if self.is_text:
            return self.data
        return json.dumps(self.data)


class DummySession:
    def get(self, url, **kwargs):
        if url == core.RSS_URL:
            text = "<?xml version='1.0'?><rss><channel></channel></rss>"
            return DummyResponse(text, is_text=True)
        if url == core.NVD_URL:
            return DummyResponse({"vulnerabilities": [1, 2]})
        return DummyResponse({"data": [1]})

    def post(self, url, **kwargs):
        return DummyResponse({})


def make_config(tmp_path: Path) -> Config:
    return Config(
        openai_api_key="k",
        twitter_bearer="b",
        teams_webhook_url="https://example.com",
        share_path=tmp_path,
    )


def test_collect(tmp_path):
    cfg = make_config(tmp_path)
    result = asyncio.run(core.collect(DummySession(), cfg, "term"))
    assert set(result.keys()) == {"rss", "nvd", "twitter"}


def test_enrich_with_llm(tmp_path, monkeypatch):
    cfg = make_config(tmp_path)

    async def fake_acreate(**kwargs):
        return {
            "choices": [
                {"message": {"content": json.dumps({"iocs": ["1.1.1.1"], "mitre": ["T1000"], "summary": "s"})}}
            ]
        }

    monkeypatch.setattr(core.openai.ChatCompletion, "acreate", fake_acreate)
    result = asyncio.run(core.enrich_with_llm({"a": 1}, cfg))
    assert result["iocs"] == ["1.1.1.1"]


def test_run_pipeline_success(tmp_path, monkeypatch):
    cfg = make_config(tmp_path)
    monkeypatch.setattr(Config, "load", classmethod(lambda cls: cfg))

    async def fake_pipeline(cfg, term):
        return {"summary": "ok", "iocs": [], "mitre": []}

    monkeypatch.setattr(core, "pipeline", fake_pipeline)
    result = core.run_pipeline("term")
    assert result["summary"] == "ok"


def test_run_pipeline_failure(tmp_path, monkeypatch):
    cfg = make_config(tmp_path)
    monkeypatch.setattr(Config, "load", classmethod(lambda cls: cfg))

    async def fake_pipeline(cfg, term):
        raise RuntimeError("boom")

    async def fake_error(url, message):
        return None

    monkeypatch.setattr(core, "pipeline", fake_pipeline)
    monkeypatch.setattr(core, "_send_error", fake_error)
    with pytest.raises(SystemExit) as exc:
        core.run_pipeline("term")
    assert exc.value.code == 1
