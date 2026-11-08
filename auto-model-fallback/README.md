# Auto Model Fallback

A server-side router that submits a conversation to configured free-tier model APIs in a fixed priority order and continues with the next provider after an error, rate limit, outage, or exhausted quota.

## Custom GPT Action (recommended)

- OpenAPI schema: `https://auto-model-fallback.vercel.app/openapi.json`
- Endpoint: `POST https://auto-model-fallback.vercel.app/api/chat`
- Authentication: **None**
- Request body: `{ "messages": [{ "role": "user", "content": "..." }] }`

In the GPT editor, open **Configure → Actions → Create new action**, import the OpenAPI schema URL, and set Authentication to **None**. Test the action in Preview before publishing the GPT.

The public endpoint accepts 1–32 text messages, with a combined limit of 30,000 characters. It applies a best-effort per-instance limit of 10 requests per IP per minute. This in-memory limit is not a robust global abuse-prevention system; enable Vercel Firewall/WAF rate limiting before sharing the endpoint publicly. Because the endpoint has no authentication, anyone who obtains its URL can consume the configured provider quotas. Never send secrets or sensitive personal data.

## Free-only providers

1. OpenRouter free router — `openrouter/free`
2. Groq Free Plan — `openai/gpt-oss-20b`
3. Google AI Studio Free Tier — `gemini-2.5-flash`

No paid model IDs or paid fallback paths are included. Provider free-tier terms and quotas can change.

## MCP compatibility

The previous authenticated MCP endpoint remains available at `/api/mcp` for existing clients. The Custom GPT Action does not use MCP and does not require an MCP connection.

## Important boundary

This is an external model router. It cannot intercept ChatGPT's internal model calls, transfer ChatGPT subscription quota, detect ChatGPT message limits, or change ChatGPT's selected model. The Custom GPT must explicitly call this Action; the completion then runs separately through the configured provider APIs.

## Vercel environment variables

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Optional server-side provider key |
| `GROQ_API_KEY` | Optional server-side provider key |
| `GEMINI_API_KEY` | Optional server-side provider key |
| `APP_URL` | Optional OpenRouter request metadata |

Provider keys remain server-side and must never be placed in the OpenAPI schema.

## Development and tests

```bash
npm install
npm test
npm run build
```
