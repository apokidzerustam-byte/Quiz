import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { providerStatus, runWithFallback } from "../lib/router";

const original = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of ["OPENROUTER_API_KEY", "GROQ_API_KEY", "ZAI_API_KEY", "GEMINI_API_KEY", "GROQ_MODEL", "GEMINI_MODEL"]) delete process.env[key];
  Object.assign(process.env, original);
  globalThis.fetch = originalFetch;
});

describe("free-only provider router", () => {
  it("reports free-only policy and no providers without keys", () => {
    for (const key of ["OPENROUTER_API_KEY", "GROQ_API_KEY", "ZAI_API_KEY", "GEMINI_API_KEY"]) delete process.env[key];
    const status = providerStatus();
    assert.equal(status.policy, "free-only");
    assert.deepEqual(status.configuredProviders, []);
    assert.equal(status.missingProviders.length, 4);
  });

  it("falls back after a rate-limited provider and returns the next response", async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter";
    process.env.GROQ_API_KEY = "test-groq";
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("openrouter.ai")) {
        return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "fallback answer" } }] }), { status: 200 });
    }) as typeof fetch;

    const result = await runWithFallback("test task", "prior context");
    assert.equal(result.text, "fallback answer");
    assert.equal(result.provider, "Groq free tier");
    assert.equal(result.attempts.length, 2);
    assert.match(calls[0], /openrouter/);
    assert.match(calls[1], /groq/);
  });

  it("stops with an error when all free providers fail", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 })) as typeof fetch;
    await assert.rejects(() => runWithFallback("test"), /All configured free providers failed/);
  });
});
