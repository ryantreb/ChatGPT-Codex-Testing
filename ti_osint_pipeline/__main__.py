"""CLI entry point for the pipeline."""

from __future__ import annotations

import sys

from .core import run_pipeline


def main() -> None:
    term = sys.argv[1] if len(sys.argv) > 1 else ""
    run_pipeline(term)


if __name__ == "__main__":  # pragma: no cover - CLI
    main()
