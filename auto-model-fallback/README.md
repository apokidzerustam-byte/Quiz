# Auto Model Fallback

A remote MCP server for ChatGPT and other MCP clients. It runs a submitted task through independent free-tier model APIs in a fixed priority order and continues with the next provider after an error, rate limit, outage, or exhausted quota.

## Important boundary

This is an external model router. It cannot intercept ChatGPT's internal model calls, transfer ChatGPT subscription quota, detect ChatGPT message limits, or change ChatGPT's selected model. ChatGPT must explicitly call the `run_task` MCP tool. The task then runs separately through the configured provider API.

## Free-only providers

The router currently supports these providers, in order:

1. **OpenRouter Free Router** — `openrouter/free`, which routes to a currently available free model. Free model requests are limited by OpenRouter (currently 20 RPM and 50 RPD on the free plan; failed requests count toward the daily cap).
2. **Groq Free Plan** — `openai/gpt-oss-20b`, listed in Groq's free-plan limits. Actual limits are account/model-specific and may change.
3. **Google AI Studio Free Tier** — `gemini-2.5-flash`. Free tier is limited and Google states that free-tier content may be used to improve its products. Do not send confidential or personal data unless you accept those terms.

No paid model IDs or paid fallback paths are included. The app does not add billing or buy credits. Provider free-tier terms and quotas can change; a $0 guarantee depends on keeping billing disabled at each provider account.

## Create your own free API keys

Keys are account credentials, not public reusable resources. Never use API keys published by strangers or paste them into chat/GitHub.

- OpenRouter: https://openrouter.ai/settings/keys
- Groq: https://console.groq.com/keys
- Google AI Studio: https://aistudio.google.com/app/apikey

Create keys in your own accounts and add them to Vercel as **Sensitive** environment variables. You can start with just one provider; the router automatically uses whichever keys are configured.

## Vercel environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MCP_ACCESS_TOKEN` | Yes | Bearer token protecting the MCP endpoint |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key; only `openrouter/free` is called |
| `GROQ_API_KEY` | Optional | Groq key; only `openai/gpt-oss-20b` is called |
| `GEMINI_API_KEY` | Optional | Google AI Studio key; only `gemini-2.5-flash` is called |
| `APP_URL` | Optional | OpenRouter request metadata |

Do not put keys in source control, plugin archives, or task prompts. Add keys through Vercel Project Settings → Environment Variables, with type Sensitive, then redeploy.

## MCP tools

Endpoint: `https://YOUR-VERCEL-DOMAIN/api/mcp`

- `run_task(task, context?)`: run the task through configured free providers.
- `fallback_status()`: show provider names and missing key variable names; secret values are never returned.

The endpoint requires a Bearer token. ChatGPT's custom MCP setup currently offers OAuth or no authentication; it does not provide a static API-key/bearer-token entry in its plugin setup UI. For a secure ChatGPT connection, implement OAuth 2.1 for the server or use a trusted authenticated proxy. Do not remove endpoint authentication on a public deployment just to make installation appear complete.

## Development and tests

```bash
npm install
npm test
npm run build
```

Tests cover provider selection, free model allowlists, and secret non-disclosure. Production build should be checked in Vercel after every source update.

## Security

- Provider keys and the MCP bearer token are server-side Sensitive environment variables.
- The status tool returns provider names and missing variable names only.
- The server does not expose arbitrary URL fetch or a generic API proxy.
- Provider calls time out after 45 seconds.
- If every configured free provider fails, the server returns a failure; it never silently switches to paid inference.
