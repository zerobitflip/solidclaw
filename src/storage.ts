import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { decryptJson, encryptJson } from "./crypto.js";
import { auditLog, credentials, deviceSessions, tokens } from "./schema.js";

export type TokenRecord = {
  accessToken: string;
  refreshToken: string;
  accountId?: string | null;
  scopes?: string | null;
  createdAt: number;
  expiresAt: number;
};

export type DeviceSession = {
  deviceCode: string;
  userCode: string;
  status: "pending" | "approved" | "denied";
  createdAt: number;
  expiresAt: number;
  approvedAt?: number | null;
  accountId?: string | null;
  scopes?: string | null;
};

const mapDevice = (row: any): DeviceSession | null => {
  if (!row) return null;
  return {
    deviceCode: row.deviceCode,
    userCode: row.userCode,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    approvedAt: row.approvedAt,
    accountId: row.accountId,
    scopes: row.scopes,
  };
};

export function insertDeviceSession(session: DeviceSession) {
  db.insert(deviceSessions)
    .values({
      deviceCode: session.deviceCode,
      userCode: session.userCode,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      approvedAt: session.approvedAt ?? null,
      accountId: session.accountId ?? null,
      scopes: session.scopes ?? null,
    })
    .run();
}

export function getDeviceSession(deviceCode: string): DeviceSession | null {
  const rows = db
    .select()
    .from(deviceSessions)
    .where(eq(deviceSessions.deviceCode, deviceCode))
    .all();
  return mapDevice(rows[0]);
}

export function getDeviceSessionByUserCode(userCode: string): DeviceSession | null {
  const rows = db
    .select()
    .from(deviceSessions)
    .where(eq(deviceSessions.userCode, userCode))
    .all();
  return mapDevice(rows[0]);
}

export function updateDeviceStatus(deviceCode: string, status: DeviceSession["status"]) {
  db.update(deviceSessions)
    .set({
      status,
      approvedAt: status === "approved" ? Date.now() : null,
    })
    .where(eq(deviceSessions.deviceCode, deviceCode))
    .run();
}

export function insertToken(record: TokenRecord) {
  db.insert(tokens)
    .values({
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      accountId: record.accountId ?? null,
      scopes: record.scopes ?? null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    })
    .run();
}

export function getToken(accessToken: string): TokenRecord | null {
  const rows = db
    .select()
    .from(tokens)
    .where(eq(tokens.accessToken, accessToken))
    .all();
  const row = rows[0];
  if (!row) return null;
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    accountId: row.accountId,
    scopes: row.scopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export function getTokenByRefresh(refreshToken: string): TokenRecord | null {
  const rows = db
    .select()
    .from(tokens)
    .where(eq(tokens.refreshToken, refreshToken))
    .all();
  const row = rows[0];
  if (!row) return null;
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    accountId: row.accountId,
    scopes: row.scopes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function upsertCredential(tool: string, payload: unknown, metadata?: unknown) {
  const encrypted = await encryptJson(payload);
  const meta = metadata ? JSON.stringify(metadata) : null;
  db.insert(credentials)
    .values({
      tool,
      payload: encrypted,
      metadata: meta,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: credentials.tool,
      set: {
        payload: encrypted,
        metadata: meta,
        updatedAt: Date.now(),
      },
    })
    .run();
}

export async function readCredential<T>(tool: string): Promise<T | null> {
  const rows = db
    .select({ payload: credentials.payload })
    .from(credentials)
    .where(eq(credentials.tool, tool))
    .all();
  const row = rows[0];
  if (!row) return null;
  return await decryptJson<T>(row.payload);
}

export function hasCredential(tool: string): boolean {
  const rows = db
    .select({ tool: credentials.tool })
    .from(credentials)
    .where(eq(credentials.tool, tool))
    .limit(1)
    .all();
  return rows.length > 0;
}

export function writeAuditLog(params: {
  action: string;
  tool?: string | null;
  accountId?: string | null;
  meta?: unknown;
}) {
  db.insert(auditLog)
    .values({
      action: params.action,
      tool: params.tool ?? null,
      accountId: params.accountId ?? null,
      createdAt: Date.now(),
      meta: params.meta ? JSON.stringify(params.meta) : null,
    })
    .run();
}
