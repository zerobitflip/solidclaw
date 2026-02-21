# Solidclaw

Solidclaw is a local credential broker + model proxy for OpenClaw.
It keeps provider keys and tool secrets out of OpenClaw, while still enabling
models, tools, and channels through scoped access tokens and env injection.

## Stack

- API: Bun + Hono
- DB: SQLite (Drizzle ORM)
- UI: Vite + React + Tailwind

## What This Enables

- **Model proxy**: OpenClaw talks to Solidclaw; Solidclaw talks to upstream.
- **Secret vault**: store tool keys in Solidclaw, not in OpenClaw.
- **Env injection**: run OpenClaw (or any command) with injected secrets.
- **Allowlist manager**: manage OpenClaw model allowlist from the UI.

## Quick Start

1. Install dependencies:

```bash
cd solidclaw
bun run install:all
```

2. Create `.env` and set at least:

```bash
cp .env.example .env
```

Required values:
- `SOLIDCLAW_MASTER_KEY` (any string)
- `SOLIDCLAW_ADMIN_TOKEN` (admin access)

3. Start API + Web:

```bash
bun run --env-file .env dev:all
```

UI: `http://localhost:5173`  
API: `http://localhost:8791`

4. Install the Solidclaw auth plugin:

```bash
openclaw plugins install -l ./solidclaw/extensions/solidclaw-auth
```

5. Authenticate OpenClaw with Solidclaw:

```bash
openclaw models auth login --provider solidclaw --method device --set-default
```

## Configure Secrets (UI)

Open the UI and add:
- **Model Proxy** credentials (upstream base URL + API key)
- **Config** (env variables for tools/plugins)
- **Openclaw allowlist** (optional)

## Run OpenClaw via Solidclaw

Inject env vars at runtime:

```bash
./bin/solidclaw env -- openclaw gateway run --allow-unconfigured
```

Auto-restart OpenClaw when env values change:

```bash
./bin/solidclaw gateway -- openclaw gateway run --allow-unconfigured
```

Useful options:
- `--interval 5` (poll interval in seconds)
- `--clean-env` (allow only PATH/HOME/SHELL/LANG and OPENCLAW_*/SOLIDCLAW_*)

Solidclaw CLI refuses to run if secret-like env vars are set directly in the shell.

## Verify Models

```bash
openclaw models list
```

You should see `solidclaw/...` models marked as configured.

## Troubleshooting

- Gateway mode warning:
  ```bash
  openclaw gateway run --allow-unconfigured
  ```
- Port in use:
  ```bash
  lsof -i :8791
  ```
- Keep OpenClaw state isolated:
  ```bash
  OPENCLAW_STATE_DIR=/tmp/openclaw-sandbox ./bin/solidclaw gateway -- openclaw gateway run --allow-unconfigured
  ```

## Configuration

Solidclaw env vars:

- `SOLIDCLAW_PORT` (default `8791`)
- `SOLIDCLAW_BASE_URL` (default `http://localhost:8791`)
- `SOLIDCLAW_WEB_URL` (default `http://localhost:5173`)
- `SOLIDCLAW_MASTER_KEY` (required, any string)
- `SOLIDCLAW_ADMIN_TOKEN` (recommended)
- `SOLIDCLAW_DB_PATH` (default `./data/solidclaw.db`)

See `solidclaw/architecture.md` for system design details.
