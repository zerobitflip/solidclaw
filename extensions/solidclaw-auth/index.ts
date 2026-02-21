import {
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
  type ProviderAuthContext,
  type ProviderAuthResult,
} from "openclaw/plugin-sdk";

const PROVIDER_ID = "solidclaw";
const PROVIDER_LABEL = "Solidclaw";
const DEFAULT_BASE_URL = "http://localhost:8791";
const DEFAULT_MODEL_IDS = [
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.2-chat-latest",
  "gpt-5.1-chat-latest",
];
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8192;

let configuredBaseUrl = DEFAULT_BASE_URL;
let configuredModelIds = DEFAULT_MODEL_IDS;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed || DEFAULT_BASE_URL;
}

function validateBaseUrl(value: string): string | undefined {
  const normalized = normalizeBaseUrl(value);
  try {
    new URL(normalized);
  } catch {
    return "Enter a valid URL";
  }
  return undefined;
}

function parseModelIds(input: string): string[] {
  const parsed = input
    .split(/[\n,]/)
    .map((model) => model.trim())
    .filter(Boolean);
  return Array.from(new Set(parsed));
}

function buildModelDefinition(modelId: string) {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions" as const,
    reasoning: false,
    input: ["text", "image"] as Array<"text" | "image">,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

async function startDeviceFlow(ctx: ProviderAuthContext, baseUrl: string) {
  const progress = ctx.prompter.progress("Starting Solidclaw device flow…");
  const response = await fetch(`${baseUrl}/device/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scopes: ["models", "secrets:telegram"] }),
  });
  if (!response.ok) {
    progress.stop("Solidclaw device flow failed");
    throw new Error(`Solidclaw /device/start failed (${response.status})`);
  }
  const payload = await response.json();
  progress.stop("Solidclaw device flow started");

  const verificationUrl = String(payload.verification_url || "");
  const userCode = String(payload.user_code || "");
  if (verificationUrl && userCode) {
    await ctx.prompter.note(
      `Open ${verificationUrl} and enter code ${userCode}.`,
      "Solidclaw Device Code",
    );
    await ctx.openUrl(verificationUrl);
  }

  const deviceCode = String(payload.device_code || "");
  if (!deviceCode) {
    throw new Error("Solidclaw returned no device_code");
  }

  const pollInterval = Math.max(Number(payload.interval) || 5, 2) * 1000;
  const started = Date.now();
  const timeoutMs = Math.max(Number(payload.expires_in) || 600, 60) * 1000;

  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    const poll = await fetch(`${baseUrl}/device/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    if (poll.status === 202) {
      continue;
    }
    if (!poll.ok) {
      throw new Error(`Solidclaw device poll failed (${poll.status})`);
    }
    const token = await poll.json();
    return token as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  }

  throw new Error("Solidclaw device flow timed out");
}

const solidclawPlugin = {
  id: "solidclaw-auth",
  name: "Solidclaw Auth",
  description: "Device-code auth for Solidclaw model proxy",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const cfg = api.pluginConfig ?? {};
    if (typeof cfg.baseUrl === "string") {
      configuredBaseUrl = normalizeBaseUrl(cfg.baseUrl);
    }
    if (Array.isArray(cfg.modelIds)) {
      configuredModelIds = cfg.modelIds.map((id) => String(id)).filter(Boolean);
    }

    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/models",
      auth: [
        {
          id: "device",
          label: "Solidclaw device code",
          hint: "Approve the gateway in the Solidclaw console",
          kind: "device_code",
          run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
            const baseUrlInput = await ctx.prompter.text({
              message: "Solidclaw base URL",
              initialValue: configuredBaseUrl,
              validate: validateBaseUrl,
            });

            const modelInput = await ctx.prompter.text({
              message: "Model IDs (comma-separated)",
              initialValue: configuredModelIds.join(", "),
              validate: (value: string) =>
                parseModelIds(value).length > 0 ? undefined : "Enter at least one model id",
            });

            const baseUrl = normalizeBaseUrl(baseUrlInput);
            const modelIds = parseModelIds(modelInput);
            const token = await startDeviceFlow(ctx, baseUrl);
            const defaultModelId = modelIds[0] ?? DEFAULT_MODEL_IDS[0];
            const defaultModelRef = `${PROVIDER_ID}/${defaultModelId}`;

            return {
              profiles: [
                {
                  profileId: `${PROVIDER_ID}:default`,
                  credential: {
                    type: "token",
                    provider: PROVIDER_ID,
                    token: token.access_token,
                    expires: Date.now() + token.expires_in * 1000,
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    [PROVIDER_ID]: {
                      baseUrl: `${baseUrl}/v1`,
                      auth: "token",
                      authHeader: true,
                      api: "openai-completions",
                      models: modelIds.map((modelId) => buildModelDefinition(modelId)),
                    },
                  },
                },
                agents: {
                  defaults: {
                    models: Object.fromEntries(
                      modelIds.map((modelId) => [`${PROVIDER_ID}/${modelId}`, {}]),
                    ),
                  },
                },
              },
              defaultModel: defaultModelRef,
              notes: [
                `Solidclaw proxy configured at ${baseUrl}.`,
                "Update Solidclaw model proxy settings if upstream keys rotate.",
              ],
            };
          },
        },
      ],
    });
  },
};

export default solidclawPlugin;
