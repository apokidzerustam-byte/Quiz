import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { configuredProviders, providerStatus, runWithFallback } from "../lib/router";

const original = { ...process.env };
const originalFetch = globalThis.fetch;
const providerKeys = ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"];

afterEach(() => {
  for (const key of providerKeys) delete process.env[key];
  Object.assign(process.env, original);
  globalThis.fetch = originalFetch;
});

describe("free-only provider router", () => {
  it("reports no configured providers when no API keys exist", () => {
    for (const key of providerKeys) delete process.env[key];
    const status = providerStatus();
    assert.equal(status.policy, "free-only");
    assert.deepEqual(status.configuredProviders, []);
    assert.equal(status.missingProviders.length, 3);
  });

  it("only selects explicitly free model routes", () => {
    const providers = configuredProviders({
      OPENROUTER_API_KEY: "test-openrouter",
      GROQ_API_KEY: "test-groq",
      GEMINI_API_KEY: "test-gemini",
    });
    assert.deepEqual(providers.map(provider => provider.model), [
      "openrouter/free",
      "openai/gpt-oss-20b",
      "gemini-2.5-flash",
    ]);
    assert.equal(providers.some(provider => /gpt-4|claude|paid/i.test(provider.model)), false);
  });

  it("does not expose provider keys in status output", () => {
    const status = JSON.stringify(providerStatus({
      OPENROUTER_API_KEY: "do-not-leak-this",
      GROQ_API_KEY: "also-secret",
    }));
    assert.equal(status.includes("do-not-leak-this"), false);
    assert.equal(status.includes("also-secret"), false);
  });

  it("falls back after a rate-limited provider and preserves context", async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter";
    process.env.GROQ_API_KEY = "test-groq";
    const calls: Array<{ url: string; body: any }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url, body });
      if (url.includes("openrouter.ai")) {
        return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "fallback answer" } }] }), { status: 200 });
    }) as typeof fetch;

    const result = await runWithFallback("test task", "prior context");
    assert.equal(result.text, "fallback answer");
    assert.equal(result.provider, "Groq Free Plan");
    assert.equal(result.attempts.length, 2);
    assert.match(calls[0].url, /openrouter/);
    assert.match(calls[1].url, /groq/);
    assert.match(calls[1].body.messages[1].content, /prior context/);
  });

  it("fails closed when every configured free provider is unavailable", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 })) as typeof fetch;
    await assert.rejects(() => runWithFallback("test"), /All configured free providers failed/);
  });
});
