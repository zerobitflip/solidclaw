import { z } from "zod";

const envSchema = z.object({
  SOLIDCLAW_PORT: z.string().optional(),
  SOLIDCLAW_BASE_URL: z.string().optional(),
  SOLIDCLAW_WEB_URL: z.string().optional(),
  SOLIDCLAW_MASTER_KEY: z.string().optional(),
  SOLIDCLAW_ADMIN_TOKEN: z.string().optional(),
  SOLIDCLAW_ACCESS_TTL_MINUTES: z.string().optional(),
  SOLIDCLAW_REFRESH_TTL_DAYS: z.string().optional(),
  SOLIDCLAW_DB_PATH: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

const parsed = envSchema.parse(process.env) as Env;

const toInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

export const config = {
  port: toInt(parsed.SOLIDCLAW_PORT, 8791),
  baseUrl: parsed.SOLIDCLAW_BASE_URL?.trim() || "http://localhost:8791",
  webUrl: parsed.SOLIDCLAW_WEB_URL?.trim() || "http://localhost:5173",
  masterKey: parsed.SOLIDCLAW_MASTER_KEY?.trim() || "",
  adminToken: parsed.SOLIDCLAW_ADMIN_TOKEN?.trim() || "",
  accessTtlMinutes: toInt(parsed.SOLIDCLAW_ACCESS_TTL_MINUTES, 60),
  refreshTtlDays: toInt(parsed.SOLIDCLAW_REFRESH_TTL_DAYS, 30),
  dbPath: parsed.SOLIDCLAW_DB_PATH?.trim() || "./data/solidclaw.db",
};
