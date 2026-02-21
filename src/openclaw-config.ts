import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LEGACY_STATE_DIRS = [".clawdbot", ".moldbot", ".moltbot"];

type OpenclawConfig = {
  models?: {
    [key: string]: unknown;
  };
  agents?: {
    defaults?: {
      models?: Record<string, Record<string, unknown>>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override.replace(/^~\//, `${os.homedir()}/`));
  }
  const home = os.homedir();
  const newDir = path.join(home, ".openclaw");
  if (fs.existsSync(newDir)) return newDir;
  for (const legacy of LEGACY_STATE_DIRS) {
    const candidate = path.join(home, legacy);
    if (fs.existsSync(candidate)) return candidate;
  }
  return newDir;
}

export function resolveOpenclawConfigPath(): string {
  return path.join(resolveStateDir(), "openclaw.json");
}

export function readOpenclawConfig(): { path: string; exists: boolean; config: OpenclawConfig } {
  const configPath = resolveOpenclawConfigPath();
  if (!fs.existsSync(configPath)) {
    return { path: configPath, exists: false, config: {} };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as OpenclawConfig;
  return { path: configPath, exists: true, config: parsed ?? {} };
}

function normalizeModels(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

export function updateAllowedModels(params: {
  models: string[];
  mode: "merge" | "replace";
}) {
  const { path: configPath, config } = readOpenclawConfig();
  const requested = normalizeModels(params.models);
  const existing = normalizeModels(Object.keys(config.agents?.defaults?.models ?? {}));
  const next = params.mode === "replace" ? requested : normalizeModels([...existing, ...requested]);

  const modelMap = Object.fromEntries(next.map((modelId) => [modelId, {}]));

  const nextConfig: OpenclawConfig = {
    ...config,
    models: config.models ? { ...config.models } : undefined,
    agents: {
      ...(config.agents ?? {}),
      defaults: {
        ...(config.agents?.defaults ?? {}),
        models: modelMap,
      },
    },
  };
  if (nextConfig.models && "allowed" in nextConfig.models) {
    delete (nextConfig.models as Record<string, unknown>).allowed;
  }

  const tmpPath = `${configPath}.solidclaw.tmp`;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(nextConfig, null, 2));
  fs.renameSync(tmpPath, configPath);

  return { path: configPath, allowed: next };
}
