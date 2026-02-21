import { Hono } from "hono";
import { z } from "zod";
import { requireAccessToken, requireAdmin } from "../middleware.js";
import { hasCredential, readCredential, upsertCredential, writeAuditLog } from "../storage.js";

const modelProxySchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
  headers: z.record(z.string()).optional(),
});

const envSchema = z.object({
  values: z.record(z.string()),
});

export const secretsRoutes = new Hono();

secretsRoutes.get("/admin/secrets/model-proxy", requireAdmin, async (c) => {
  const payload = await readCredential<z.infer<typeof modelProxySchema>>("model-proxy");
  if (!payload) {
    return c.json({ error: "not_configured" }, 404);
  }
  return c.json(payload);
});

secretsRoutes.get("/admin/secrets/model-proxy/status", requireAdmin, async (c) => {
  return c.json({ exists: hasCredential("model-proxy") });
});

secretsRoutes.get("/secrets/env", requireAccessToken, async (c) => {
  const payload = await readCredential<z.infer<typeof envSchema>>("env");
  if (!payload) {
    return c.json({ values: {} });
  }
  const rawKeys = c.req.query("keys");
  const keys = rawKeys ? rawKeys.split(",").map((key) => key.trim()).filter(Boolean) : [];
  if (keys.length === 0) {
    return c.json(payload);
  }
  const filtered: Record<string, string> = {};
  for (const key of keys) {
    const value = payload.values[key];
    if (typeof value === "string") {
      filtered[key] = value;
    }
  }
  return c.json({ values: filtered });
});

secretsRoutes.get("/admin/secrets/env", requireAdmin, async (c) => {
  const payload = await readCredential<z.infer<typeof envSchema>>("env");
  if (!payload) {
    return c.json({ values: {} });
  }
  return c.json(payload);
});

secretsRoutes.post("/admin/secrets/env", requireAdmin, async (c) => {
  const body = envSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  await upsertCredential("env", body.data);
  writeAuditLog({ action: "secrets.update", tool: "env" });
  return c.json({ ok: true });
});

secretsRoutes.post("/admin/secrets/model-proxy", requireAdmin, async (c) => {
  const body = modelProxySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  await upsertCredential("model-proxy", body.data);
  writeAuditLog({ action: "secrets.update", tool: "model-proxy" });
  return c.json({ ok: true });
});
