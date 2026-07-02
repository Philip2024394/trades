// GET /api/platform/design/list
//   ?category=&query=
//
// Serialized catalogue of every Design System component. AI SDK
// consumers, SSR flows, and future third-party integrations read from
// here rather than needing to import the React registry directly.

import { NextResponse } from "next/server";
import { designSystemRegistry } from "@/platform/design/registry";
import { serializeRegistration } from "@/platform/design/serialization";
import "@/platform/design/components";
import { loadStudioSession } from "@/lib/studio/session";
import type { DesignComponentCategory } from "@/platform/design/types";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("query");

  let regs = query
    ? designSystemRegistry.search(query, 200)
    : designSystemRegistry.list();

  if (category) {
    regs = regs.filter((r) => r.category === category);
  }

  const items = regs.map(serializeRegistration);
  const categories = Array.from(
    new Set(designSystemRegistry.list().map((r) => r.category))
  ).sort() as DesignComponentCategory[];

  return NextResponse.json({
    ok: true,
    items,
    totalRegistered: designSystemRegistry.size(),
    facets: { categories }
  });
}
