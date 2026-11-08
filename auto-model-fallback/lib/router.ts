type Provider = {
  name: string;
  model: string;
  endpoint: string;
  key: string;
  kind: "openai" | "gemini";
  headers?: Record<string, string>;
};
export type RunResult = { text: string; provider: string; model: string; attempts: string[] };

const SYSTEM_PROMPT =
  "Complete the user's task as fully as possible. Preserve all constraints and supplied context. Do not claim to have performed external actions. State uncertainty and limitations rather than inventing results.";

export function configuredProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const providers: Provider[] = [];

  // OpenRouter's dynamic router explicitly selects only currently available free models.
  if (env.OPENROUTER_API_KEY) providers.push({
    name: "OpenRouter free pool",
    model: "openrouter/free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    key: env.OPENROUTER_API_KEY,
    kind: "openai",
    headers: {
      "HTTP-Referer": env.APP_URL || "https://localhost",
      "X-Title": "Auto Model Fallback",
    },
  });

  // GPT-OSS 20B is listed under Groq's Free Plan limits.
  if (env.GROQ_API_KEY) providers.push({
    name: "Groq Free Plan",
    model: "openai/gpt-oss-20b",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    key: env.GROQ_API_KEY,
    kind: "openai",
  });

  // Only select a model with an explicitly published Google AI Studio free tier.
  if (env.GEMINI_API_KEY) providers.push({
    name: "Google AI Studio Free Tier",
    model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    key: env.GEMINI_API_KEY,
    kind: "gemini",
  });

  return providers;
}

export function providerStatus(env: NodeJS.ProcessEnv = process.env) {
  const configured = configuredProviders(env);
  const keys = ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"];
  return {
    policy: "free-only",
    configuredProviders: configured.map(p => ({ provider: p.name, model: p.model, configured: true })),
    missingProviders: keys.filter(k => !env[k]),
    note: "No paid provider or paid model fallback is configured. Free-tier quotas are limited and controlled by each provider. The router only calls the explicitly free OpenRouter route and free-tier model IDs.",
  };
}

async function parseResponse(response: Response): Promise<Record<string, any>> {
  return response.json().catch(() => ({}));
}

async function askOpenAICompatible(p: Provider, prompt: string): Promise<string> {
  const response = await fetch(p.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${p.key}`,
      ...p.headers,
    },
    body: JSON.stringify({
      model: p.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    throw new Error(`${response.status}: ${body?.error?.message || response.statusText}${retry ? ` (retry-after ${retry}s)` : ""}`);
  }
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Provider returned an empty response");
  return text;
}

async function askGemini(p: Provider, prompt: string): Promise<string> {
  const response = await fetch(`${p.endpoint}/${p.model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": p.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    throw new Error(`${response.status}: ${body?.error?.message || response.statusText}${retry ? ` (retry-after ${retry}s)` : ""}`);
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text || "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Provider returned an empty response");
  return text;
}

export async function runWithFallback(task: string, context?: string): Promise<RunResult> {
  if (!task.trim()) throw new Error("Task cannot be empty");
  const providers = configuredProviders();
  if (!providers.length) {
    throw new Error("No free provider is configured. Add an API key from OpenRouter, Groq, or Google AI Studio in Vercel Environment Variables.");
  }

  const prompt = context
    ? `TASK:\n${task}\n\nCONTEXT / PREVIOUS WORK:\n${context}`
    : task;
  const attempts: string[] = [];

  for (const p of providers) {
    try {
      const text = p.kind === "gemini"
        ? await askGemini(p, prompt)
        : await askOpenAICompatible(p, prompt);
      return {
        text,
        provider: p.name,
        model: p.model,
        attempts: [...attempts, `${p.name}: success`],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push(`${p.name}: ${message.slice(0, 240)}`);
    }
  }

  throw new Error("All configured free providers failed. " + attempts.join(" | "));
}
