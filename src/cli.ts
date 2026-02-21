import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { config as solidclawConfig } from "./config.js";

const LEGACY_STATE_DIRS = [".clawdbot", ".moldbot", ".moltbot"];

type AuthProfileStore = {
  version: number;
  profiles: Record<string, { type: string; provider: string; token?: string; access?: string }>;
};

function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override.replace(/^~\//, `${os.homedir()}/`));
  }
  const home = os.homedir();
  const newDir = path.join(home, ".openclaw");
  if (fs.existsSync(newDir)) {
    return newDir;
  }
  for (const legacy of LEGACY_STATE_DIRS) {
    const candidate = path.join(home, legacy);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return newDir;
}

function resolveAgentDir(): string {
  const override =
    process.env.OPENCLAW_AGENT_DIR?.trim() || process.env.PI_CODING_AGENT_DIR?.trim();
  if (override) {
    return path.resolve(override.replace(/^~\//, `${os.homedir()}/`));
  }
  return path.join(resolveStateDir(), "agents", "default", "agent");
}

function readSolidclawToken(): string | null {
  if (process.env.SOLIDCLAW_ACCESS_TOKEN?.trim()) {
    return process.env.SOLIDCLAW_ACCESS_TOKEN.trim();
  }
  const stateDir = resolveStateDir();
  const agentDir = resolveAgentDir();
  const candidates = [path.join(stateDir, "auth-profiles.json"), path.join(agentDir, "auth-profiles.json")];
  const agentsDir = path.join(stateDir, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(agentsDir, entry.name, "agent", "auth-profiles.json");
      candidates.push(candidate);
    }
  }
  for (const authPath of candidates) {
    if (!fs.existsSync(authPath)) continue;
    const raw = fs.readFileSync(authPath, "utf8");
    const parsed = JSON.parse(raw) as AuthProfileStore;
    for (const profile of Object.values(parsed.profiles ?? {})) {
      if (profile.provider === "solidclaw") {
        const token = profile.token || profile.access;
        if (typeof token === "string" && token.trim()) {
          return token.trim();
        }
      }
    }
  }
  return null;
}

function usage() {
  console.log(`Usage:
  solidclaw env [--keys KEY1,KEY2] -- <command>
  solidclaw gateway [--keys KEY1,KEY2] [--interval 5] [--] openclaw gateway run
  solidclaw gateway --clean-env --allow PATH,HOME,LANG -- openclaw gateway run

Environment:
  SOLIDCLAW_BASE_URL (default ${solidclawConfig.baseUrl})
  SOLIDCLAW_ACCESS_TOKEN (optional, otherwise reads OpenClaw auth-profiles.json)
`);
}

function parseKeys(argv: string[]) {
  const keysFlagIndex = argv.indexOf("--keys");
  let keys: string[] = [];
  if (keysFlagIndex !== -1) {
    const raw = argv[keysFlagIndex + 1] ?? "";
    keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
    argv.splice(keysFlagIndex, 2);
  }
  return keys;
}

function parseInterval(argv: string[]) {
  const idx = argv.indexOf("--interval");
  if (idx === -1) return 5;
  const raw = argv[idx + 1];
  argv.splice(idx, 2);
  const val = raw ? Number.parseInt(raw, 10) : 5;
  return Number.isFinite(val) && val > 0 ? val : 5;
}

const DEFAULT_CLEAN_ALLOW = ["PATH", "HOME", "SHELL", "LANG"];

const SECRET_NAME_PATTERNS: RegExp[] = [
  /_API_KEY$/i,
  /_TOKEN$/i,
  /_SECRET$/i,
  /_PASSWORD$/i,
  /_WEBHOOK$/i,
  /_ACCESS_KEY$/i,
  /_PRIVATE_KEY$/i,
  /_CLIENT_SECRET$/i,
];

const SECRET_NAME_EXACT = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "BRAVE_API_KEY",
  "PERPLEXITY_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "SLACK_SIGNING_SECRET",
  "DISCORD_BOT_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TELNYX_API_KEY",
  "PLIVO_AUTH_ID",
  "PLIVO_AUTH_TOKEN",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "MSTEAMS_APP_ID",
  "MSTEAMS_APP_PASSWORD",
  "MSTEAMS_TENANT_ID",
  "SIGNAL_PHONE_NUMBER",
  "SIGNAL_CLI_PATH",
]);

function findDisallowedEnvKeys(params: {
  injected: Record<string, string>;
  env: NodeJS.ProcessEnv;
}) {
  const disallowed: string[] = [];
  for (const [key, value] of Object.entries(params.env)) {
    if (key.startsWith("OPENCLAW_") || key.startsWith("SOLIDCLAW_")) continue;
    if (typeof value !== "string" || value.trim() === "") continue;
    if (params.injected[key]) continue;
    if (SECRET_NAME_EXACT.has(key) || SECRET_NAME_PATTERNS.some((pattern) => pattern.test(key))) {
      disallowed.push(key);
    }
  }
  return disallowed;
}

function assertNoDirectSecrets(injected: Record<string, string>) {
  const disallowed = findDisallowedEnvKeys({ injected, env: process.env });
  if (disallowed.length === 0) return;
  console.error(
    [
      "Direct secret env vars detected:",
      disallowed.join(", "),
      "Refusing to run. Store secrets in Solidclaw Config and inject via Solidclaw.",
    ].join(" "),
  );
  process.exit(2);
}

function parseCleanEnv(argv: string[]) {
  const idx = argv.indexOf("--clean-env");
  if (idx === -1) {
    return { enabled: false, allow: [] as string[] };
  }
  argv.splice(idx, 1);
  const allowIdx = argv.indexOf("--allow");
  let allow: string[] = [];
  if (allowIdx !== -1) {
    const raw = argv[allowIdx + 1] ?? "";
    allow = raw.split(",").map((k) => k.trim()).filter(Boolean);
    argv.splice(allowIdx, 2);
  }
  return { enabled: true, allow: allow.length > 0 ? allow : DEFAULT_CLEAN_ALLOW };
}

function buildCleanEnv(params: { allow: string[]; injected: Record<string, string> }) {
  const env: Record<string, string> = {};
  const allow = new Set(params.allow);
  for (const key of allow) {
    const value = process.env[key];
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if ((key.startsWith("OPENCLAW_") || key.startsWith("SOLIDCLAW_")) && typeof value === "string") {
      env[key] = value;
    }
  }
  return { ...env, ...params.injected };
}

async function fetchEnvValues(params: { baseUrl: string; token: string; keys: string[] }) {
  const query = params.keys.length > 0 ? `?keys=${encodeURIComponent(params.keys.join(","))}` : "";
  const res = await fetch(`${params.baseUrl}/secrets/env${query}`, {
    headers: { authorization: `Bearer ${params.token}` },
  });
  if (!res.ok) {
    throw new Error(`Solidclaw env fetch failed (${res.status})`);
  }
  const payload = (await res.json()) as { values?: Record<string, string> };
  return payload.values ?? {};
}

function hashEnv(values: Record<string, string>): string {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

async function runEnvCommand(argv: string[]) {
  const keys = parseKeys(argv);
  const clean = parseCleanEnv(argv);
  const sepIndex = argv.indexOf("--");
  const cmd = sepIndex === -1 ? argv : argv.slice(sepIndex + 1);
  if (cmd.length === 0) {
    usage();
    process.exit(1);
  }

  const token = readSolidclawToken();
  if (!token) {
    console.error("No Solidclaw access token found. Run: openclaw models auth login --provider solidclaw");
    process.exit(1);
  }

  const baseUrl = (process.env.SOLIDCLAW_BASE_URL || solidclawConfig.baseUrl).replace(/\/$/, "");
  const values = await fetchEnvValues({ baseUrl, token, keys });

  assertNoDirectSecrets(values);
  const env = clean.enabled
    ? buildCleanEnv({ allow: clean.allow, injected: values })
    : { ...process.env, ...values };

  const child = spawn(cmd[0], cmd.slice(1), {
    stdio: "inherit",
    env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function runGatewayCommand(argv: string[]) {
  const keys = parseKeys(argv);
  const interval = parseInterval(argv);
  const clean = parseCleanEnv(argv);
  const sepIndex = argv.indexOf("--");
  const cmd = sepIndex === -1 ? argv : argv.slice(sepIndex + 1);
  const gatewayCmd = cmd.length > 0 ? cmd : ["openclaw", "gateway", "run"];

  const token = readSolidclawToken();
  if (!token) {
    console.error("No Solidclaw access token found. Run: openclaw models auth login --provider solidclaw");
    process.exit(1);
  }

  const baseUrl = (process.env.SOLIDCLAW_BASE_URL || solidclawConfig.baseUrl).replace(/\/$/, "");

  let currentValues = await fetchEnvValues({ baseUrl, token, keys });
  assertNoDirectSecrets(currentValues);
  let currentHash = hashEnv(currentValues);
  let env = clean.enabled
    ? buildCleanEnv({ allow: clean.allow, injected: currentValues })
    : { ...process.env, ...currentValues };

  let stoppingForRestart = false;

  const spawnGateway = () =>
    spawn(gatewayCmd[0], gatewayCmd.slice(1), {
      stdio: "inherit",
      env,
    });

  let child = spawnGateway();

  const waitForExit = (proc: ReturnType<typeof spawn>) =>
    new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
    });

  const restart = async () => {
    stoppingForRestart = true;
    if (!child.killed) {
      child.kill("SIGTERM");
      await waitForExit(child);
    }
    env = clean.enabled
      ? buildCleanEnv({ allow: clean.allow, injected: currentValues })
      : { ...process.env, ...currentValues };
    child = spawnGateway();
    stoppingForRestart = false;
  };

  setInterval(async () => {
    try {
      const nextValues = await fetchEnvValues({ baseUrl, token, keys });
      assertNoDirectSecrets(nextValues);
      const nextHash = hashEnv(nextValues);
      if (nextHash !== currentHash) {
        currentValues = nextValues;
        currentHash = nextHash;
        await restart();
      }
    } catch (err) {
      console.error(String(err));
    }
  }, interval * 1000);

  child.on("exit", (code) => {
    if (stoppingForRestart) return;
    process.exit(code ?? 0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(1);
  }
  const [command, ...rest] = args;
  if (command === "env") {
    await runEnvCommand(rest);
    return;
  }
  if (command === "gateway") {
    await runGatewayCommand(rest);
    return;
  }
  usage();
  process.exit(1);
}

void main();
