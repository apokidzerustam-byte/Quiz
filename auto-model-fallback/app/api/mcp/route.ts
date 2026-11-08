import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { runWithFallback, providerStatus } from "@/lib/router";

const server = new (await import("@modelcontextprotocol/sdk/server/mcp.js")).McpServer({
  name: "auto-model-fallback",
  version: "0.1.0",
});

server.tool(
  "run_task",
  "Run a task through free-tier AI providers in sequence. The router skips unavailable, rate-limited, or exhausted providers and never switches to paid models. Provide the task and any context needed; this tool cannot intercept or replace ChatGPT's own underlying model.",
  {
    task: z.string().min(1).max(30000).describe("The task to execute"),
    context: z.string().max(30000).optional().describe("Optional context or prior work to preserve"),
  },
  async ({ task, context }) => {
    const result = await runWithFallback(task, context);
    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        provider: result.provider,
        model: result.model,
        attempts: result.attempts,
        freeOnly: true,
      },
    };
  }
);

server.tool(
  "fallback_status",
  "Show which free-tier providers are configured. Does not reveal API keys.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(providerStatus(), null, 2) }],
    structuredContent: providerStatus(),
  })
);

const handler = createMcpHandler(server);
export { handler as GET, handler as POST, handler as DELETE };
export const runtime = "nodejs";
export const maxDuration = 60;
