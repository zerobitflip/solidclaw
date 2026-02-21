import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../middleware.js";
import { readOpenclawConfig, updateAllowedModels } from "../openclaw-config.js";
import { writeAuditLog } from "../storage.js";

const allowedModelsSchema = z.object({
  models: z.array(z.string()).default([]),
  mode: z.enum(["merge", "replace"]).optional(),
});

export const openclawRoutes = new Hono();

openclawRoutes.get("/admin/openclaw/allowed-models", requireAdmin, async (c) => {
  try {
    const payload = readOpenclawConfig();
    const allowed = payload.config.agents?.defaults?.models
      ? Object.keys(payload.config.agents.defaults.models)
      : [];
    return c.json({ path: payload.path, allowed });
  } catch (err) {
    return c.json({ error: (err as Error).message || "read_failed" }, 500);
  }
});

openclawRoutes.post("/admin/openclaw/allowed-models", requireAdmin, async (c) => {
  const body = allowedModelsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  try {
    const result = updateAllowedModels({
      models: body.data.models,
      mode: body.data.mode ?? "merge",
    });
    writeAuditLog({ action: "openclaw.allowlist.update", tool: "openclaw" });
    return c.json({ ok: true, path: result.path, allowed: result.allowed });
  } catch (err) {
    return c.json({ error: (err as Error).message || "write_failed" }, 500);
  }
});
