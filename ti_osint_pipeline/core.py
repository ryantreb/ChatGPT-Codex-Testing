"""Core business logic for the threat intel pipeline."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import aiohttp
import feedparser
import openai

from .config import Config
from .logging_cfg import configure_logging


RSS_URL = "https://example.com/rss"
NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
TWITTER_URL = "https://api.twitter.com/2/tweets/search/recent"


class PipelineError(Exception):
    """Base error for pipeline failures."""


async def fetch_rss(session: aiohttp.ClientSession, term: str) -> Any:
    params = {"q": term}
    async with session.get(RSS_URL, params=params) as resp:
        resp.raise_for_status()
        text = await resp.text()
        feed = feedparser.parse(text)
        return feed.entries[:100]


async def fetch_nvd(session: aiohttp.ClientSession, term: str) -> Any:
    params = {"keywordSearch": term, "resultsPerPage": 100}
    async with session.get(NVD_URL, params=params) as resp:
        resp.raise_for_status()
        data = await resp.json()
        return data.get("vulnerabilities", [])[:100]


async def fetch_twitter(session: aiohttp.ClientSession, bearer: str, term: str) -> Any:
    headers = {"Authorization": f"Bearer {bearer}"}
    params = {"query": term, "max_results": 10}
    async with session.get(TWITTER_URL, headers=headers, params=params) as resp:
        resp.raise_for_status()
        data = await resp.json()
        return data.get("data", [])[:100]


async def collect(session: aiohttp.ClientSession, cfg: Config, term: str) -> Dict[str, Any]:
    rss, nvd, twitter = await asyncio.gather(
        fetch_rss(session, term),
        fetch_nvd(session, term),
        fetch_twitter(session, cfg.twitter_bearer, term),
    )
    return {"rss": rss, "nvd": nvd, "twitter": twitter}


async def enrich_with_llm(data: Dict[str, Any], cfg: Config) -> Dict[str, Any]:
    truncated_json = json.dumps(data)[:2000]
    messages = [
        {
            "role": "user",
            "content": (
                "You are a senior cyber-threat analyst. Extract IoCs (IPs, domains, "
                "hashes, CVEs) and MITRE ATT&CK IDs; then output STRICT JSON with "
                'keys: "iocs", "mitre", "summary" (≤120 words).\n\n' +
                f"RAW_DATA:\n{truncated_json}"
            ),
        }
    ]
    try:
        openai.api_key = cfg.openai_api_key
        response = await openai.ChatCompletion.acreate(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
            max_tokens=600,
            timeout=40,
        )
    except Exception as exc:  # pragma: no cover - network errors
        raise PipelineError("openai failure") from exc

    content = response["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:  # pragma: no cover - unlikely
        raise PipelineError("invalid LLM JSON") from exc


async def send_teams_message(session: aiohttp.ClientSession, url: str, message: str) -> None:
    payload = {"text": message}
    async with session.post(url, json=payload) as resp:
        resp.raise_for_status()


async def _send_error(url: str, message: str) -> None:
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        await send_teams_message(session, url, message)


def _write_files(base: Path, data: Dict[str, Any]) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = base / f"{ts}.json"
    md_path = base / f"{ts}.md"
    try:
        json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        md_contents = [f"# Summary\n{data.get('summary', '')}\n", "## IoCs"]
        for ioc in data.get("iocs", []):
            md_contents.append(f"- {ioc}")
        md_contents.append("## MITRE")
        for mitre in data.get("mitre", []):
            md_contents.append(f"- {mitre}")
        md_path.write_text("\n".join(md_contents), encoding="utf-8")
    except OSError as exc:  # pragma: no cover - filesystem errors
        raise PipelineError("file write failure") from exc


async def pipeline(cfg: Config, term: str) -> Dict[str, Any]:
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        collected = await collect(session, cfg, term)
        enriched = await enrich_with_llm(collected, cfg)
        await send_teams_message(session, cfg.teams_webhook_url, enriched.get("summary", ""))
        _write_files(cfg.share_path, enriched)
        return enriched


def run_pipeline(term: str) -> Dict[str, Any]:
    """Entry point for running the pipeline synchronously."""
    configure_logging()
    logging.info("pipeline_start")
    cfg = Config.load()
    try:
        result = asyncio.run(pipeline(cfg, term))
    except Exception as exc:
        logging.exception("pipeline_error")
        try:
            asyncio.run(_send_error(cfg.teams_webhook_url, str(exc)))
        except Exception:
            pass
        raise SystemExit(1) from exc
    logging.info("pipeline_complete")
    return result
