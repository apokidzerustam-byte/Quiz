# Auto Model Fallback

A remote MCP server that ChatGPT can call as an external tool. It runs the submitted task against a sequence of free-tier model APIs and switches provider when one fails, is rate-limited, or has exhausted its quota.

## Important: what this does and does not do

This service **does not intercept ChatGPT's internal model calls**, detect ChatGPT message limits, or change the model selected by ChatGPT. ChatGPT must explicitly call the `run_task` MCP tool. The server then runs that task separately using provider APIs and returns the result to ChatGPT.

Free provider quotas are finite, may change, and are not guaranteed to be available continuously. This app never configures paid models as fallback.

## Providers

Providers are tried in this order when their keys are configured:

1. OpenRouter `openrouter/free` — dynamic free-model pool.
2. Groq — free-tier API model.
3. Z.AI — GLM Flash free model.
4. Google Gemini API — optional; check regional eligibility, quotas, and free-tier data-use terms before sending private information.

The router only enables a provider when its server-side API key exists. It does not ask for a payment method or configure paid models.

## Environment variables

Set these in Vercel Project Settings → Environment Variables. Use encrypted/sensitive values and never paste keys into chat or commit them to GitHub.

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Optional | Uses the `openrouter/free` route, not a paid model. Free route is rate-limited. |
| `GROQ_API_KEY` | Optional | Uses `llama-3.3-70b-versatile` by default. |
| `GROQ_MODEL` | Optional | Only override with a model that is free on your Groq account. |
| `ZAI_API_KEY` | Optional | Uses `glm-4.7-flash`. |
| `GEMINI_API_KEY` | Optional | Google AI Studio key; check EEA availability and data handling first. |
| `GEMINI_MODEL` | Optional | Only override with a model that is free on your Google AI Studio account. |
| `APP_URL` | Optional | Public app URL for OpenRouter request metadata. |

At least one API key is required. To preserve the $0 policy, do not configure a paid model or paid provider key. The router cannot guarantee a provider will never change its pricing; review provider pricing periodically.

## MCP tools

Endpoint: `https://YOUR-VERCEL-DOMAIN/api/mcp`

- `run_task(task, context?)`: execute a task using the first working configured free provider.
- `fallback_status()`: show configured providers and missing key names without revealing secrets.

## ChatGPT connection

ChatGPT must support custom MCP connections for your plan/workspace. Current OpenAI documentation says full MCP with write/modify support is available to Business, Enterprise, and Edu; Pro has read/fetch-only custom MCP access. Free accounts cannot use this custom MCP connection path at present. The service can still be used by another MCP client or through its own API client.

## Local development

```bash
npm install
npm run dev
npm test
npm run build
```

## Security

- API keys are read only from server-side environment variables.
- The MCP status tool never returns secret values.
- The endpoint does not expose a generic proxy or arbitrary URL fetch.
- Provider calls time out after 45 seconds.
- No paid fallback is present.
