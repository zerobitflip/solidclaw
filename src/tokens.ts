import { config } from "./config.js";
import {
  getToken,
  getTokenByRefresh,
  insertToken,
  type TokenRecord,
} from "./storage.js";

function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Buffer.from(buf).toString("hex");
}

export function issueToken(params: { accountId?: string | null; scopes?: string[] }) {
  const now = Date.now();
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const expiresAt = now + config.accessTtlMinutes * 60_000;
  const record: TokenRecord = {
    accessToken,
    refreshToken,
    accountId: params.accountId ?? null,
    scopes: params.scopes ? params.scopes.join(" ") : null,
    createdAt: now,
    expiresAt,
  };
  insertToken(record);
  return {
    accessToken,
    refreshToken,
    expiresAt,
    expiresIn: Math.floor((expiresAt - now) / 1000),
  };
}

export function validateAccessToken(token: string): TokenRecord | null {
  const record = getToken(token);
  if (!record) return null;
  if (Date.now() >= record.expiresAt) return null;
  return record;
}

export function refreshAccessToken(refreshToken: string) {
  const existing = getTokenByRefresh(refreshToken);
  if (!existing) return null;
  return issueToken({
    accountId: existing.accountId,
    scopes: existing.scopes ? existing.scopes.split(/\s+/).filter(Boolean) : undefined,
  });
}
