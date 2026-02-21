import type { Context, Next } from "hono";
import { config } from "./config.js";
import { validateAccessToken } from "./tokens.js";

export async function requireAdmin(c: Context, next: Next) {
  if (!config.adminToken) {
    return await next();
  }
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== config.adminToken) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return await next();
}

export async function requireAccessToken(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return c.json({ error: "missing_token" }, 401);
  }
  const record = validateAccessToken(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }
  c.set("token", record);
  return await next();
}
