// GET /api/brain-admin/queue?brain_slug=<slug>
//
// Returns every Author-accepted candidate whose admin_status is
// currently non-terminal (unreviewed / sent_back / changes_requested).
// The Admin's primary work queue.

import type { NextRequest } from "next/server";
import { listAdminPending } from "@/lib/nex/brains/_studio/_extraction";
import { jsonError, jsonOk, requireBrainAdmin } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireBrainAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const slug = url.searchParams.get("brain_slug");
  if (!slug || slug.trim() === "") return jsonError("bad_request", "brain_slug query param is required");

  const pending = await listAdminPending(slug.trim());
  return jsonOk({
    brain_slug: slug.trim(),
    count:      pending.length,
    candidates: pending
  });
}
