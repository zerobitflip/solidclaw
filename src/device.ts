import { config } from "./config.js";
import {
  getDeviceSession,
  getDeviceSessionByUserCode,
  insertDeviceSession,
  updateDeviceStatus,
  type DeviceSession,
} from "./storage.js";
import { issueToken } from "./tokens.js";

function randomCode(bytes: number, alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let out = "";
  for (const value of buf) {
    out += alphabet[value % alphabet.length];
  }
  return out;
}

export function startDeviceSession(params?: { accountId?: string | null; scopes?: string[] }) {
  const deviceCode = randomCode(32, "abcdefghijklmnopqrstuvwxyz0123456789");
  const userCode = `${randomCode(4)}-${randomCode(4)}`;
  const now = Date.now();
  const expiresAt = now + 10 * 60_000;
  const session: DeviceSession = {
    deviceCode,
    userCode,
    status: "pending",
    createdAt: now,
    expiresAt,
    accountId: params?.accountId ?? null,
    scopes: params?.scopes?.join(" ") ?? null,
  };
  insertDeviceSession(session);
  return {
    deviceCode,
    userCode,
    verificationUrl: `${config.webUrl.replace(/\/$/, "")}/device`,
    expiresIn: Math.floor((expiresAt - now) / 1000),
    interval: 5,
  };
}

export function approveDeviceSession(userCode: string) {
  const session = getDeviceSessionByUserCode(userCode);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) return null;
  updateDeviceStatus(session.deviceCode, "approved");
  return { ...session, status: "approved" as const };
}

export function denyDeviceSession(userCode: string) {
  const session = getDeviceSessionByUserCode(userCode);
  if (!session) return null;
  updateDeviceStatus(session.deviceCode, "denied");
  return { ...session, status: "denied" as const };
}

export function pollDeviceSession(deviceCode: string) {
  const session = getDeviceSession(deviceCode);
  if (!session) return { status: "invalid" as const };
  if (Date.now() >= session.expiresAt) return { status: "expired" as const };
  if (session.status === "pending") return { status: "pending" as const };
  if (session.status === "denied") return { status: "denied" as const };
  const token = issueToken({
    accountId: session.accountId ?? undefined,
    scopes: session.scopes ? session.scopes.split(/\s+/).filter(Boolean) : undefined,
  });
  return { status: "approved" as const, token };
}
