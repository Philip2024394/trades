// GET /api/nex/kpe/plugins — list every registered pipeline stage plugin
//
// Also returns registered AI providers so admins can verify the AI Gateway
// registry state at a glance.

import { NextResponse } from "next/server";
import { ensureDefaultsLoaded, listPlugins } from "@/lib/nex/kpe/registry";
import { listAIProviders } from "@/lib/nex/kpe/stages/ai-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaultsLoaded();
  return NextResponse.json({
    ok: true,
    backend: "filesystem",
    stages: listPlugins(),
    ai_providers: listAIProviders(),
  });
}
