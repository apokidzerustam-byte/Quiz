type Provider = {
  name: string;
  model: string;
  endpoint: string;
  key: string;
  kind: "openai" | "gemini";
};

type RunResult = { text: string; provider: string; model: string; attempts: string[] };

function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.OPENROUTER_API_KEY) providers.push({
    name: "OpenRouter Free", model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, kind: "openai"
  });
  if (process.env.GROQ_API_KEY) providers.push({
    name: "Groq Free Tier", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, kind: "openai"
  });
  if (process.env.GEMINI_API_KEY) providers.push({
    name: "Google Gemini Free Tier", model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models", key: process.env.GEMINI_API_KEY, kind: "gemini"
  });
  return providers;
}

export function providerStatus() {
  const configured = configuredProviders();
  return {
    policy: "free-only",
    configuredProviders: configured.map(p => ({ provider: p.name, model: p.model, configured: true })),
    missingProviders: ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"].filter(k => !process.env[k]),
    note: "Free tiers have provider-specific quotas. No paid model fallback is configured."
  };
}

async function askOpenAICompatible(p: Provider, prompt: string): Promise<string> {
  const response = await fetch(p.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${p.key}`,
      ...(p.name.startsWith("OpenRouter") ? { "HTTP-Referer": process.env.APP_URL || "https://localhost", "X-Title": "Auto Model Fallback" } : {})
    },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: "system", content: "Complete the user's task as fully as possible. If context includes prior work, continue from it. State limitations rather than inventing results." }, { role: "user", content: prompt }],
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body?.error?.message || response.statusText}`);
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Provider returned an empty response");
  return text;
}

async function askGemini(p: Provider, prompt: string): Promise<string> {
  const response = await fetch(`${p.endpoint}/${p.model}:generateContent?key=${encodeURIComponent(p.key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Complete the user's task as fully as possible. State limitations rather than inventing results.\n\n" + prompt }] }] }),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body?.error?.message || response.statusText}`);
  const text = body?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text || "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Provider returned an empty response");
  return text;
}

export async function runWithFallback(task: string, context?: string): Promise<RunResult> {
  const providers = configuredProviders();
  if (!providers.length) throw new Error("No free provider is configured. Add at least one free-tier API key in Vercel Environment Variables.");
  const prompt = context ? `TASK:\n${task}\n\nCONTEXT / PREVIOUS WORK:\n${context}` : task;
  const attempts: string[] = [];
  for (const p of providers) {
    try {
      const text = p.kind === "gemini" ? await askGemini(p, prompt) : await askOpenAICompatible(p, prompt);
      return { text, provider: p.name, model: p.model, attempts: [...attempts, `${p.name}: success`] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push(`${p.name}: ${message.slice(0, 300)}`);
    }
  }
  throw new Error("All configured free providers failed. " + attempts.join(" | "));
}
