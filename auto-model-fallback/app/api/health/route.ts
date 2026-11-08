import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "auto-model-fallback",
    version: "0.3.0",
    policy: "free-only",
    providers: providerStatus(),
  });
}
