# TI OSINT Pipeline

A simplified open-source intelligence pipeline that collects RSS, NVD and Twitter data, enriches it with OpenAI, and sends results to Microsoft Teams.

## Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .[dev]
   ```
2. Copy `.env.example` to `.env` and set `SHARE_PATH` or other non-secret values. The
   application will prompt for the OpenAI API key, Twitter bearer token and
   Microsoft Teams webhook URL at runtime if they are not provided via
   environment variables.
3. Run the pipeline:
   ```bash
   python -m ti_osint_pipeline "search term"
   ```

## Testing

```bash
pytest --cov=ti_osint_pipeline
```

## Notes

This project demonstrates secure configuration loading, asynchronous HTTP calls and minimal GUI integration. It is not intended for production use.
