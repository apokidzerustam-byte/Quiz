# Auto Model Fallback

A remote MCP server for ChatGPT that sends a supplied task to free-tier model APIs in order, skipping providers that are unavailable, rate-limited, or out of quota.

## Important limitation

This MCP app cannot intercept, inspect, or replace the model that powers ChatGPT itself, and it cannot detect when your ChatGPT subscription/message quota is exhausted. ChatGPT calls the MCP tool as an external tool; the MCP server then runs the task independently through configured provider APIs. ChatGPT must be able to connect to custom MCP apps on your plan/workspace. Current ChatGPT documentation limits full custom MCP write-capable connections to supported plans/workspaces; check Settings > Apps / Plugins on ChatGPT web.

## Free-only behavior

- Only provider APIs explicitly configured by you are used.
- No paid model fallback is included.
- OpenRouter is restricted by default to a model ID ending in `:free`.
- Groq and Gemini use their free-tier API quotas; those quotas and availability are controlled by each provider and can change.
- If every free provider is exhausted or unavailable, the tool returns an error instead of making a paid request.
- Provider keys are read from server-side environment variables and are never returned by the status tool.

## Configure

Deploy this Next.js app to Vercel, then add one or more API keys under Project Settings → Environment Variables:

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Optional OpenRouter key; default model is a free model |
| `OPENROUTER_MODEL` | Optional free model ID; must be a free model on your OpenRouter account |
| `GROQ_API_KEY` | Optional Groq free-tier key |
| `GROQ_MODEL` | Optional Groq model ID |
| `GEMINI_API_KEY` | Optional Google AI Studio free-tier key |
| `GEMINI_MODEL` | Optional Gemini model ID |
| `APP_URL` | Optional public URL used in OpenRouter request metadata |

At least one provider key is required. Do not add billing or paid models if you want to retain the free-only guarantee.

## MCP endpoint

After deployment, configure the public endpoint `https://YOUR-DOMAIN/api/mcp` in ChatGPT's custom MCP app settings.

Tools:
- `run_task(task, context?)`: executes the task using the first working configured free provider.
- `fallback_status()`: reports configured providers without exposing secrets.

## Local development

```bash
npm install
npm run dev
```

## Tests

```bash
npm run build
```

Before production use, test each provider key with a small request and verify that exhausted/invalid keys cause the router to continue to the next provider.
