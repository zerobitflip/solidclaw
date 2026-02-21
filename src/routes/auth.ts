import { Hono } from "hono";
import { z } from "zod";
import { approveDeviceSession, denyDeviceSession, pollDeviceSession, startDeviceSession } from "../device.js";
import { refreshAccessToken } from "../tokens.js";
import { requireAdmin } from "../middleware.js";

const deviceStartSchema = z.object({
  accountId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

const devicePollSchema = z.object({
  device_code: z.string().min(10),
});

const deviceApproveSchema = z.object({
  user_code: z.string().min(4),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(10),
});

export const authRoutes = new Hono();

authRoutes.post("/device/start", async (c) => {
  const body = deviceStartSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const session = startDeviceSession({
    accountId: body.data.accountId,
    scopes: body.data.scopes,
  });
  return c.json({
    device_code: session.deviceCode,
    user_code: session.userCode,
    verification_url: session.verificationUrl,
    expires_in: session.expiresIn,
    interval: session.interval,
  });
});

authRoutes.post("/device/poll", async (c) => {
  const body = devicePollSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const result = pollDeviceSession(body.data.device_code);
  if (result.status === "pending") {
    return c.json({ error: "authorization_pending" }, 202);
  }
  if (result.status === "denied") {
    return c.json({ error: "access_denied" }, 403);
  }
  if (result.status === "expired") {
    return c.json({ error: "expired_token" }, 410);
  }
  if (result.status === "invalid") {
    return c.json({ error: "invalid_device_code" }, 400);
  }
  return c.json({
    access_token: result.token.accessToken,
    refresh_token: result.token.refreshToken,
    expires_in: result.token.expiresIn,
    token_type: "bearer",
  });
});

authRoutes.post("/device/approve", requireAdmin, async (c) => {
  const body = deviceApproveSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const session = approveDeviceSession(body.data.user_code.trim().toUpperCase());
  if (!session) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ ok: true });
});

authRoutes.post("/device/deny", requireAdmin, async (c) => {
  const body = deviceApproveSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const session = denyDeviceSession(body.data.user_code.trim().toUpperCase());
  if (!session) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ ok: true });
});

authRoutes.post("/token/refresh", async (c) => {
  const body = refreshSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const token = refreshAccessToken(body.data.refresh_token);
  if (!token) {
    return c.json({ error: "invalid_refresh_token" }, 401);
  }
  return c.json({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_in: token.expiresIn,
    token_type: "bearer",
  });
});
