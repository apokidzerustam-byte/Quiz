import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { runWithFallback, providerStatus } from "@/lib/router";

const handler = createMcpHandler((server) => {
  server.registerTool(
    "run_task",
    {
      title: "Run task with free model fallback",
      description: "Run a submitted task through configured free-tier AI APIs in order. Automatically moves to the next provider when one is unavailable, rate-limited, or out of quota. Never uses a paid fallback. This is a separate external model call; it cannot replace ChatGPT's own model or bypass ChatGPT plan limits.",
      inputSchema: z.object({
        task: z.string().min(1).max(30000).describe("The task to execute"),
        context: z.string().max(30000).optional().describe("Prior work and constraints to preserve across the provider handoff"),
      }),
    },
    async ({ task, context }) => {
      try {
        const result = await runWithFallback(task, context);
        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: { provider: result.provider, model: result.model, attempts: result.attempts, freeOnly: true },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }
  );

  server.registerTool(
    "fallback_status",
    {
      title: "Free provider status",
      description: "Show configured free-tier providers and missing API key names. Never reveals secret values.",
      inputSchema: z.object({}),
    },
    async () => {
      const status = providerStatus();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }], structuredContent: status };
    }
  );
});

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  const expected = process.env.MCP_ACCESS_TOKEN;
  if (!expected || !bearerToken) return undefined;
  const a = Buffer.from(bearerToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  return { token: bearerToken, scopes: ["tasks:run", "status:read"], clientId: "auto-model-fallback-chatgpt" };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true, requiredScopes: ["tasks:run"] });
export { authHandler as GET, authHandler as POST };
export const runtime = "nodejs";
export const maxDuration = 60;
