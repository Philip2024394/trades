// GET /api/platform/design/[id]
//
// Single component lookup — used by AI-driven insert flows to fetch
// starter props + content for a component before rendering it.

import { NextResponse } from "next/server";
import { designSystemRegistry } from "@/platform/design/registry";
import { serializeRegistration } from "@/platform/design/serialization";
import "@/platform/design/components";
import { loadStudioSession } from "@/lib/studio/session";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const reg = designSystemRegistry.get(id);
  if (!reg) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    component: serializeRegistration(reg),
    describe: designSystemRegistry.describe(id)
  });
}
