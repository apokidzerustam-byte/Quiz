import test from "node:test";
import assert from "node:assert/strict";
import { configuredProviders, providerStatus } from "./router";

test("free-only router starts with no providers when no keys are configured", () => {
  assert.deepEqual(configuredProviders({}), []);
  assert.equal(providerStatus({}).policy, "free-only");
});

test("only explicitly configured providers are returned", () => {
  const providers = configuredProviders({
    OPENROUTER_API_KEY: "test-openrouter",
    GROQ_API_KEY: "test-groq",
    GEMINI_API_KEY: "test-gemini"
  });
  assert.equal(providers.length, 3);
  assert.deepEqual(providers.map(p => p.name), [
    "OpenRouter free pool",
    "Groq free developer tier",
    "Google AI Studio free tier"
  ]);
});

test("OpenRouter is pinned to its free-only router alias", () => {
  const [provider] = configuredProviders({ OPENROUTER_API_KEY: "test" });
  assert.equal(provider.model, "openrouter/free");
  assert.match(provider.endpoint, /openrouter\.ai/);
});

test("model selection cannot be overridden with a paid model via environment", () => {
  const providers = configuredProviders({
    GROQ_API_KEY: "test",
    GROQ_MODEL: "a-paid-model",
    GEMINI_API_KEY: "test",
    GEMINI_MODEL: "a-paid-model"
  });
  assert.equal(providers[0].model, "llama-3.1-8b-instant");
  assert.equal(providers[1].model, "gemini-2.5-flash");
});

test("status never exposes configured secret values", () => {
  const status = JSON.stringify(providerStatus({ GEMINI_API_KEY: "do-not-leak" }));
  assert.equal(status.includes("do-not-leak"), false);
  assert.match(status, /Google AI Studio free tier/);
});
