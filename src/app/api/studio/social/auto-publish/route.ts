// POST /api/studio/social/auto-publish
// Body: { enabled: boolean }

import { NextResponse, type NextRequest } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { setAutoPublish } from "@/lib/nex/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null) as { enabled?: boolean } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ ok: false, error: "missing_enabled" }, { status: 400 });
  await setAutoPublish({
    merchantSlug: session.merchant.slug,
    enabled:      body.enabled,
    actor:        `merchant:${session.merchant.slug}`
  });
  return NextResponse.json({ ok: true });
}
