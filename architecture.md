# Solidclaw Architecture

## Goals

- Keep model/provider keys and tool secrets out of OpenClaw.
- Issue scoped access tokens to OpenClaw.
- Provide a single source of truth for credentials and audit logs.
- Proxy model traffic so OpenClaw never sees upstream API keys.
- Enforce “no direct secrets” usage via Solidclaw CLI and skills.

## High-Level Flow

1. OpenClaw starts a device-code flow against Solidclaw.
2. User approves the device code in the Solidclaw UI.
3. Solidclaw issues access tokens.
4. OpenClaw uses the token to:
   - call the Solidclaw model proxy (`/v1/*`)
   - fetch injected env secrets (`/secrets/env`)
5. Solidclaw CLI runs OpenClaw with injected secrets and restarts on changes.

## Components

### API (Bun + Hono)

Routes:
- `GET /health`
- `POST /device/start`
- `POST /device/poll`
- `POST /device/approve`
- `POST /device/deny`
- `POST /token/refresh`
- `GET /secrets/env`
- `GET /admin/secrets/env`
- `POST /admin/secrets/env`
- `GET /admin/secrets/model-proxy`
- `GET /admin/secrets/model-proxy/status`
- `POST /admin/secrets/model-proxy`
- `GET /admin/openclaw/allowed-models`
- `POST /admin/openclaw/allowed-models`
- `ALL /v1/*` (proxy to upstream)

### Storage (SQLite + Drizzle)

Tables:
- `device_sessions`
- `tokens`
- `credentials`
- `audit_log`

Credentials are encrypted with AES-GCM. `SOLIDCLAW_MASTER_KEY` can be any string
and is normalized to a 32-byte key.

### Console (Vite + React + Tailwind)

- Approve device codes
- Configure model proxy target
- Manage env injector key/value pairs
- Manage OpenClaw model allowlist

### CLI Wrapper

- Fetches stored env keys from Solidclaw.
- Executes any command with those env vars injected.
- Auto-restarts OpenClaw when secrets change.
- Refuses to run if secret-like env vars are set directly in the shell.

### OpenClaw Integration

#### solidclaw-auth plugin

- Provides a `solidclaw` provider with device-code auth.
- Writes model provider config pointing at Solidclaw `/v1` proxy.
- Ships a “no direct secrets” skill that always redirects users to Solidclaw.

## Security Model

- Access tokens are short-lived.
- Secrets are encrypted at rest.
- Admin endpoints require `SOLIDCLAW_ADMIN_TOKEN`.
- CLI refuses direct secret env usage.

## Future Work

- Per-tool scopes and finer-grained audit details.
- Admin CLI for secrets management.
- Multi-tenant accounts and org policies.
