// GET /api/studio/editor/catalog
//
// Serves the Editor's right-sidebar catalogue: containers, heroes,
// buttons, sections. Hero library reads from disk on this server so
// this route is where the section registry + hero library get loaded
// once + returned to the client.

import { NextResponse } from "next/server";
import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { loadCatalog } from "@/lib/studio/editor/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const sections = sectionRegistry.list().map((s) => ({
    id: s.id,
    name: (s as { name?: string }).name,
    category: (s as { category?: string }).category,
    description: (s as { description?: string }).description,
    bestForVerticals: (s as { bestForVerticals?: readonly string[] }).bestForVerticals
  }));
  const catalog = loadCatalog(sections);
  return NextResponse.json({
    ok: true,
    counts: {
      containers: catalog.containers.length,
      heroes: catalog.heroes.length,
      buttons: catalog.buttons.length,
      sections: catalog.sections.length
    },
    catalog
  });
}
