import { useMemo, useState, useEffect } from "react";

const DEFAULT_API = import.meta.env.VITE_SOLIDCLAW_API_BASE || "http://localhost:8791";

type TabKey = "device" | "model" | "env";

type RequestState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

const KNOWN_MODEL_GROUPS = [
  {
    label: "Solidclaw (OpenAI proxy)",
    items: [
      "solidclaw/gpt-5.2",
      "solidclaw/gpt-5.1",
      "solidclaw/gpt-5",
      "solidclaw/gpt-5-mini",
      "solidclaw/gpt-5-nano",
      "solidclaw/gpt-5.2-chat-latest",
      "solidclaw/gpt-5.1-chat-latest",
    ],
  },
  {
    label: "Anthropic",
    items: [
      "anthropic/claude-3-7-sonnet-20250219",
      "anthropic/claude-opus-4-5",
      "anthropic/claude-opus-4-6",
    ],
  },
];

const cardBase =
  "rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-crisp backdrop-blur";

function useRequest() {
  const [state, setState] = useState<RequestState>({ status: "idle" });
  return {
    state,
    start: () => setState({ status: "loading" }),
    success: (message?: string) => setState({ status: "success", message }),
    error: (message?: string) => setState({ status: "error", message }),
  };
}

export function SolidclawApp() {
  const [tab, setTab] = useState<TabKey>("device");
  const [adminToken, setAdminToken] = useState(
    localStorage.getItem("solidclaw_admin_token") || "",
  );
  const [revealAdmin, setRevealAdmin] = useState(false);

  const apiBase = useMemo(() => DEFAULT_API.replace(/\/$/, ""), []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f1e7d2,transparent_60%),linear-gradient(120deg,#f7f1e7,#f4f0e8)] px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-4 rounded-[32px] border border-ink/10 bg-white/70 p-8 shadow-crisp">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ink/60">Solidclaw Console</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">
              Credentials live here. OpenClaw borrows them.
            </h1>
            <p className="mt-2 max-w-2xl text-ink/70">
              Manage device-code approvals, Telegram secrets, and model proxy configuration from one
              place.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="text-sm font-medium text-ink/70">Admin token</label>
          <div className="flex w-full items-center gap-2">
            <input
              className="w-full rounded-full border border-ink/20 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={adminToken}
              type={revealAdmin ? "text" : "password"}
              onChange={(event) => {
                setAdminToken(event.target.value);
                localStorage.setItem("solidclaw_admin_token", event.target.value);
              }}
              placeholder="SOLIDCLAW_ADMIN_TOKEN"
            />
            <button
              onClick={() => setRevealAdmin((value) => !value)}
              className="rounded-full border border-ink/20 px-3 py-2 text-xs font-semibold text-ink"
            >
              {revealAdmin ? "Hide" : "Show"}
            </button>
          </div>
            <span className="text-xs text-ink/50">Needed for approving devices + secrets.</span>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          {([
            { key: "device", label: "Device Codes" },
          { key: "model", label: "Model Proxy" },
          { key: "env", label: "Config" },
        ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? "bg-ink text-white"
                  : "border border-ink/10 bg-white/70 text-ink hover:border-ink/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "device" && (
          <DevicePanel apiBase={apiBase} adminToken={adminToken} />
        )}
        {tab === "model" && (
          <ModelPanel apiBase={apiBase} adminToken={adminToken} />
        )}
        {tab === "env" && <EnvPanel apiBase={apiBase} adminToken={adminToken} />}
      </div>
    </div>
  );
}

function DevicePanel({ apiBase, adminToken }: { apiBase: string; adminToken: string }) {
  const [userCode, setUserCode] = useState("");
  const request = useRequest();

  const approve = async (deny = false) => {
    request.start();
    try {
      const res = await fetch(`${apiBase}/device/${deny ? "deny" : "approve"}` , {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: JSON.stringify({ user_code: userCode.trim().toUpperCase() }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      request.success(deny ? "Device code denied." : "Device code approved.");
    } catch (err) {
      request.error((err as Error).message || "Request failed");
    }
  };

  return (
    <section className={cardBase}>
      <h2 className="text-2xl font-semibold">Approve a device code</h2>
      <p className="mt-2 text-ink/70">
        When OpenClaw asks for a device code, paste it here to authorize the gateway.
      </p>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-[0.2em] text-ink/50">User Code</label>
          <input
            className="mt-2 w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-lg uppercase tracking-widest"
            value={userCode}
            onChange={(event) => setUserCode(event.target.value)}
            placeholder="ABCD-EFGH"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => approve(false)}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Approve
          </button>
          <button
            onClick={() => approve(true)}
            className="rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold text-ink"
          >
            Deny
          </button>
        </div>
      </div>
      <StatusBanner state={request.state} />
    </section>
  );
}

function ModelPanel({ apiBase, adminToken }: { apiBase: string; adminToken: string }) {
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com");
  const [apiKey, setApiKey] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [allowLoaded, setAllowLoaded] = useState(false);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState("");
  const request = useRequest();
  const allowRequest = useRequest();

  useEffect(() => {
    if (!adminToken || loaded) return;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/admin/secrets/model-proxy`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) {
          const payload = (await res.json()) as { baseUrl?: string; apiKey?: string };
          if (payload.baseUrl) setBaseUrl(payload.baseUrl);
          if (payload.apiKey) setApiKey(payload.apiKey);
          setHasSecret(Boolean(payload.apiKey));
          return;
        }
        const status = await fetch(`${apiBase}/admin/secrets/model-proxy/status`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        if (status.ok) {
          const payload = (await status.json()) as { exists?: boolean };
          setHasSecret(Boolean(payload.exists));
        }
      } finally {
        setLoaded(true);
      }
    };
    void load();
  }, [adminToken, apiBase, loaded]);

  useEffect(() => {
    if (!adminToken || allowLoaded) return;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/admin/openclaw/allowed-models`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { allowed?: string[] };
        setAllowedModels(Array.isArray(payload.allowed) ? payload.allowed : []);
      } finally {
        setAllowLoaded(true);
      }
    };
    void load();
  }, [adminToken, apiBase, allowLoaded]);

  const save = async () => {
    request.start();
    try {
      const res = await fetch(`${apiBase}/admin/secrets/model-proxy`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setHasSecret(Boolean(apiKey.trim()));
      request.success("Model proxy configuration saved.");
    } catch (err) {
      request.error((err as Error).message || "Request failed");
    }
  };

  const normalizeModels = (input: string) =>
    Array.from(
      new Set(
        input
          .split(/[\n,]/)
          .map((model) => model.trim())
          .filter(Boolean),
      ),
    );

  const toggleAllowed = (modelId: string) => {
    setAllowedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  const applyDraft = () => {
    const draftModels = normalizeModels(modelDraft);
    if (draftModels.length === 0) return;
    setAllowedModels((prev) => normalizeModels([...prev, ...draftModels].join(",")));
    setModelDraft("");
  };

  const saveAllowlist = async () => {
    allowRequest.start();
    try {
      const res = await fetch(`${apiBase}/admin/openclaw/allowed-models`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: JSON.stringify({ models: allowedModels, mode: "replace" }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const payload = (await res.json()) as { allowed?: string[] };
      setAllowedModels(Array.isArray(payload.allowed) ? payload.allowed : allowedModels);
      allowRequest.success("Openclaw allowlist updated.");
    } catch (err) {
      allowRequest.error((err as Error).message || "Request failed");
    }
  };

  return (
    <section className={cardBase}>
      <h2 className="text-2xl font-semibold">Model proxy</h2>
      <p className="mt-2 text-ink/70">
        Solidclaw will proxy OpenAI-compatible traffic to the upstream provider using this key.
      </p>
      {!adminToken ? (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 px-4 py-3 text-xs text-ink/70">
          Enter `SOLIDCLAW_ADMIN_TOKEN` above to load saved secrets.
        </div>
      ) : null}
      <div className="mt-6 grid gap-4">
        <input
          className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm"
          placeholder="Upstream base URL"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm"
          placeholder="Upstream API key"
          type={reveal ? "text" : "password"}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        {hasSecret ? (
          <span className="text-xs font-semibold text-accent">
            Upstream key saved
          </span>
        ) : null}
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setReveal((value) => !value)}
          className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink"
        >
          {reveal ? "Hide values" : "Reveal values"}
        </button>
        <button
          onClick={save}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
        >
          Save
        </button>
      </div>
      <StatusBanner state={request.state} />
      <div className="mt-10 border-t border-ink/10 pt-6">
        <h3 className="text-xl font-semibold">Openclaw model allowlist</h3>
        <p className="mt-2 text-ink/70">
          Select models to allow in Openclaw. Solidclaw will update Openclaw&apos;s agent model list
          directly.
        </p>
        {!adminToken ? (
          <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 px-4 py-3 text-xs text-ink/70">
            Enter `SOLIDCLAW_ADMIN_TOKEN` above to update Openclaw config.
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {KNOWN_MODEL_GROUPS.map((group) => (
            <div key={group.label} className="rounded-2xl border border-ink/10 p-4">
              <div className="text-xs font-semibold text-ink/60">{group.label}</div>
              <div className="mt-3 space-y-2">
                {group.items.map((modelId) => (
                  <label
                    key={modelId}
                    className="flex items-center gap-2 text-xs text-ink/80"
                  >
                    <input
                      type="checkbox"
                      checked={allowedModels.includes(modelId)}
                      onChange={() => toggleAllowed(modelId)}
                    />
                    <span className="font-mono">{modelId}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <label className="text-xs uppercase tracking-[0.2em] text-ink/50">
            Add custom models (comma or newline separated)
          </label>
          <textarea
            className="mt-2 h-24 w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm"
            placeholder="anthropic/claude-opus-4-5"
            value={modelDraft}
            onChange={(event) => setModelDraft(event.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <button
            onClick={applyDraft}
            className="rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold text-ink"
          >
            Add draft to selection
          </button>
          <button
            onClick={saveAllowlist}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
          >
            Save allowlist
          </button>
        </div>
        <StatusBanner state={allowRequest.state} />
      </div>
    </section>
  );
}

function StatusBanner({ state }: { state: RequestState }) {
  if (state.status === "idle") return null;
  const tone =
    state.status === "loading"
      ? "bg-ink/10 text-ink"
      : state.status === "success"
        ? "bg-accent/10 text-accent"
        : "bg-red-100 text-red-700";
  return (
    <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${tone}`}>
      {state.status === "loading" ? "Working…" : state.message}
    </div>
  );
}

type EnvRow = { key: string; value: string };

const SUGGESTED_ENV_GROUPS = [
  {
    label: "Models",
    items: [
      { key: "OPENAI_API_KEY", label: "OpenAI API key" },
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API key" },
      { key: "OPENROUTER_API_KEY", label: "OpenRouter API key" },
    ],
  },
  {
    label: "Web Tools",
    items: [
      { key: "BRAVE_API_KEY", label: "Brave Search API key" },
      { key: "PERPLEXITY_API_KEY", label: "Perplexity API key" },
    ],
  },
  {
    label: "Messaging",
    items: [
      { key: "TELEGRAM_BOT_TOKEN", label: "Telegram bot token" },
      { key: "SLACK_BOT_TOKEN", label: "Slack bot token" },
      { key: "SLACK_APP_TOKEN", label: "Slack app token" },
      { key: "SLACK_SIGNING_SECRET", label: "Slack signing secret" },
      { key: "DISCORD_BOT_TOKEN", label: "Discord bot token" },
    ],
  },
  {
    label: "Calling",
    items: [
      { key: "TWILIO_ACCOUNT_SID", label: "Twilio account SID" },
      { key: "TWILIO_AUTH_TOKEN", label: "Twilio auth token" },
      { key: "TELNYX_API_KEY", label: "Telnyx API key" },
      { key: "PLIVO_AUTH_ID", label: "Plivo auth id" },
      { key: "PLIVO_AUTH_TOKEN", label: "Plivo auth token" },
    ],
  },
  {
    label: "Email",
    items: [
      { key: "GMAIL_CLIENT_ID", label: "Gmail client id" },
      { key: "GMAIL_CLIENT_SECRET", label: "Gmail client secret" },
      { key: "GMAIL_REFRESH_TOKEN", label: "Gmail refresh token" },
    ],
  },
  {
    label: "Teams + Signal",
    items: [
      { key: "MSTEAMS_APP_ID", label: "Microsoft Teams app id" },
      { key: "MSTEAMS_APP_PASSWORD", label: "Microsoft Teams app password" },
      { key: "MSTEAMS_TENANT_ID", label: "Microsoft Teams tenant id" },
      { key: "SIGNAL_PHONE_NUMBER", label: "Signal phone number" },
      { key: "SIGNAL_CLI_PATH", label: "Signal CLI path" },
    ],
  },
];

function EnvPanel({ apiBase, adminToken }: { apiBase: string; adminToken: string }) {
  const [rows, setRows] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [loaded, setLoaded] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [filter, setFilter] = useState("");
  const request = useRequest();

  useEffect(() => {
    if (!adminToken || loaded) return;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/admin/secrets/env`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { values?: Record<string, string> };
        const entries = Object.entries(payload.values ?? {}).map(([key, value]) => ({
          key,
          value,
        }));
        setRows(entries.length > 0 ? entries : [{ key: "", value: "" }]);
      } finally {
        setLoaded(true);
      }
    };
    void load();
  }, [adminToken, apiBase, loaded]);

  const save = async () => {
    request.start();
    try {
      const values: Record<string, string> = {};
      for (const row of rows) {
        if (row.key.trim()) {
          values[row.key.trim()] = row.value;
        }
      }
      const res = await fetch(`${apiBase}/admin/secrets/env`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: adminToken ? `Bearer ${adminToken}` : "",
        },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      request.success("Env keys updated.");
    } catch (err) {
      request.error((err as Error).message || "Request failed");
    }
  };

  const updateRow = (index: number, patch: Partial<EnvRow>) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, { key: "", value: "" }]);
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  const addSuggestedKey = (key: string) => {
    setRows((prev) => {
      if (prev.some((row) => row.key.trim() === key)) {
        return prev;
      }
      return [...prev, { key, value: "" }];
    });
  };
  const removeSuggestedKey = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key.trim() !== key));
  };

  return (
    <section className={cardBase}>
      <h2 className="text-2xl font-semibold">Config</h2>
      <p className="mt-2 text-ink/70">
        Store environment variables once and inject them via the Solidclaw CLI wrapper. Direct
        secret env vars are rejected by the CLI.
      </p>
      {!adminToken ? (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 px-4 py-3 text-xs text-ink/70">
          Enter `SOLIDCLAW_ADMIN_TOKEN` above to load saved env keys.
        </div>
      ) : null}
      <div className="mt-6 rounded-3xl border border-ink/10 bg-white/80 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/50">Suggested keys</div>
          <input
            className="w-full rounded-full border border-ink/15 bg-white px-3 py-2 text-xs md:w-64"
            placeholder="Filter keys…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {SUGGESTED_ENV_GROUPS.map((group) => {
            const filtered = group.items.filter((item) => {
              const query = filter.trim().toLowerCase();
              if (!query) return true;
              return (
                item.key.toLowerCase().includes(query) ||
                item.label.toLowerCase().includes(query)
              );
            });
            if (filtered.length === 0) {
              return null;
            }
            return (
              <div key={group.label} className="rounded-2xl border border-ink/10 p-3">
                <div className="text-xs font-semibold text-ink/70">{group.label}</div>
                <div className="mt-2 space-y-2">
                  {filtered.map((item) => {
                    const checked = rows.some((row) => row.key.trim() === item.key);
                    return (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 text-xs text-ink/80"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            event.target.checked
                              ? addSuggestedKey(item.key)
                              : removeSuggestedKey(item.key)
                          }
                        />
                        <span className="font-mono">{item.key}</span>
                        <span className="text-ink/50">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.key}-${index}`} className="flex flex-col gap-2 md:flex-row">
            <input
              className="flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm"
              placeholder="ENV_KEY"
              value={row.key}
              onChange={(event) => updateRow(index, { key: event.target.value })}
            />
            <div className="flex-1 flex gap-2">
              <input
                className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm"
                placeholder="value"
                type={reveal ? "text" : "password"}
                value={row.value}
                onChange={(event) => updateRow(index, { value: event.target.value })}
              />
              <button
                onClick={() => removeRow(index)}
                className="rounded-2xl border border-ink/20 px-3 py-2 text-xs font-semibold text-ink"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setReveal((value) => !value)}
            className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink"
          >
            {reveal ? "Hide values" : "Reveal values"}
          </button>
          <button
            onClick={addRow}
            className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink"
          >
            Add key
          </button>
        </div>
        <button
          onClick={save}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
        >
          Save
        </button>
      </div>
      <StatusBanner state={request.state} />
    </section>
  );
}
