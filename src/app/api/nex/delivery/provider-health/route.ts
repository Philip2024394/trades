// GET /api/nex/delivery/provider-health — run health() on every registered adapter
// Used by the System Health panel to show real per-provider status.
import { NextResponse } from "next/server";
import { checkAllProviderHealth, providerEnvHints } from "@/lib/nex/delivery/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const [health, hints] = await Promise.all([checkAllProviderHealth(), Promise.resolve(providerEnvHints())]);
  return NextResponse.json({ ok: true, providers: health, env_hints: hints });
}
