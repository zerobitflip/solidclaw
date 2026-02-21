import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const deviceSessions = sqliteTable("device_sessions", {
  deviceCode: text("device_code").primaryKey(),
  userCode: text("user_code").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  approvedAt: integer("approved_at"),
  accountId: text("account_id"),
  scopes: text("scopes"),
});

export const tokens = sqliteTable("tokens", {
  accessToken: text("access_token").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  accountId: text("account_id"),
  scopes: text("scopes"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const credentials = sqliteTable("credentials", {
  tool: text("tool").primaryKey(),
  payload: text("payload").notNull(),
  metadata: text("metadata"),
  updatedAt: integer("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  tool: text("tool"),
  accountId: text("account_id"),
  createdAt: integer("created_at").notNull(),
  meta: text("meta"),
});
