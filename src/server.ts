import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { secretsRoutes } from "./routes/secrets.js";
import { proxyRoutes } from "./routes/proxy.js";
import { openclawRoutes } from "./routes/openclaw.js";

const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/", authRoutes);
app.route("/", secretsRoutes);
app.route("/", openclawRoutes);
app.route("/", proxyRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  port: config.port,
  fetch: app.fetch,
};
