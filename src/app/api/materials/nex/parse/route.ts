// POST /api/materials/nex/parse
// Body: { text: string }
// Returns: { ok: true, data: { intent: NexIntent, memory_match: MemoryMatch } }
//
// The heart of the Add-Stock workflow: takes what the owner typed, calls
// the LLM to extract intent, resolves the material against Memory, and
// hands the pair back to the UI to render a confirmation screen. No DB
// mutation happens here.

import { requireAuth } from "@/lib/nex/brains/_auth";
import { parseIntent } from "@/apps/materials/_services/nex_intent";
import { findMemoryByQuery } from "@/apps/materials/_services/memory";
import { errorResponse, okResponse } from "@/apps/materials/_services/_route_helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";

    const intent = await parseIntent(text);

    if (intent.action !== "add_stock") {
      return okResponse({ intent, memory_match: { kind: "none" as const } });
    }

    const memory_match = await findMemoryByQuery(user.email, intent.material_query);
    return okResponse({ intent, memory_match });
  } catch (e) {
    return errorResponse(e);
  }
}
