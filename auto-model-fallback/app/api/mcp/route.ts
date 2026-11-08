import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { runWithFallback, providerStatus } from "@/lib/router";

const handler = createMcpHandler((server) => {
  server.tool(
    "run_task",
    "Run a task through configured free-tier AI APIs in order. Automatically moves to the next provider when one is unavailable, rate-limited, or out of quota. Never uses a paid fallback. This is a separate external model call; it cannot replace ChatGPT's own model or bypass ChatGPT plan limits.",
    {
      task: z.string().min(1).max(30000).describe("The task to execute"),
      context: z.string().max(30000).optional().describe("Prior work and constraints to preserve across the provider handoff"),
    },
    async ({ task, context }) => {
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }
  );

  server.tool(
    "fallback_status",
    "Show configured free-tier providers and missing API key names. Never reveals secret values.",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify(providerStatus(), null, 2) }],
      structuredContent: providerStatus(),
    })
  );
}, {
  serverInfo: { name: "auto-model-fallback", version: "0.3.0" },
  capabilities: { tools: {} },
});

export { handler as GET, handler as POST, handler as DELETE };
export const runtime = "nodejs";
export const maxDuration = 60;
