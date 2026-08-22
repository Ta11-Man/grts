# GRTS Scout

The discovery engine for finding new roles, de-duplicating them against your existing application database, and presenting them in a beautiful dashboard.

## Setup
1. Define your target career pages in `config.yaml`.
2. Run `scout.py` periodically (e.g., via cron or Windows Task Scheduler) to generate the `scout_feed.json` output.
```powershell
python scout.py
```

## Running the Dashboard
Since the dashboard fetches a local json file via JS `fetch()`, simply double-clicking `dashboard.html` won't work perfectly due to browser CORS policies for `file://` protocols.

Run a lightweight local HTTP server from this `scout` directory:
```bash
python -m http.server 8080
```
Then visit `http://localhost:8080/dashboard.html` in your browser to view your cards!

## Local AI Fallback (Ollama)
For sites like standard Workday or custom startup pages, the `parse_with_llm` function in `scout.py` utilizes a locally hosted `llama3` model via the Ollama JSON Mode API. Make sure Ollama is installed and running locally.
