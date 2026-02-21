import { createHash } from "node:crypto";
import { config } from "./config.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function ensureMasterKey(): Uint8Array {
  if (!config.masterKey) {
    throw new Error("SOLIDCLAW_MASTER_KEY is required.");
  }
  const raw = Buffer.from(config.masterKey, "base64");
  if (raw.length === 32) {
    return new Uint8Array(raw);
  }
  // Fallback: derive a 32-byte key from any string via SHA-256.
  // This allows arbitrary strings while keeping AES-GCM requirements satisfied.
  const hashed = createHash("sha256").update(config.masterKey).digest();
  return new Uint8Array(hashed);
}

async function importKey(): Promise<CryptoKey> {
  const key = ensureMasterKey();
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function base64Encode(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64");
}

function base64Decode(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export async function encryptJson(payload: unknown): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return [base64Encode(iv), base64Encode(encrypted)].join(".");
}

export async function decryptJson<T>(value: string): Promise<T> {
  const [ivRaw, dataRaw] = value.split(".");
  if (!ivRaw || !dataRaw) {
    throw new Error("Invalid encrypted payload format");
  }
  const iv = base64Decode(ivRaw);
  const data = base64Decode(dataRaw);
  const key = await importKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(decoder.decode(decrypted)) as T;
}
