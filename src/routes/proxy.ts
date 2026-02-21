import { Hono } from "hono";
import { requireAccessToken } from "../middleware.js";
import { readCredential } from "../storage.js";

export type ProxyConfig = {
  baseUrl: string;
  apiKey: string;
  headers?: Record<string, string>;
};

async function resolveProxyConfig(): Promise<ProxyConfig | null> {
  return await readCredential<ProxyConfig>("model-proxy");
}

async function forward(c: any, path: string) {
  const config = await resolveProxyConfig();
  if (!config) {
    return c.json({ error: "model_proxy_not_configured" }, 503);
  }
  const upstream = new URL(path, config.baseUrl.replace(/\/$/, "") + "/");
  const headers = new Headers(c.req.raw.headers);
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      headers.set(key, value);
    }
  }
  headers.delete("host");
  const resp = await fetch(upstream, {
    method: c.req.method,
    headers,
    body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.arrayBuffer(),
  });
  const contentType = resp.headers.get("content-type");
  if (contentType) {
    c.header("content-type", contentType);
  }
  return c.body(resp.body, resp.status);
}

export const proxyRoutes = new Hono();

proxyRoutes.all("/v1/*", requireAccessToken, async (c) => {
  const path = c.req.path.replace(/^\/?/, "");
  return forward(c, path);
});
