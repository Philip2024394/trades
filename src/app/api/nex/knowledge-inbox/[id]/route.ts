// /api/nex/knowledge-inbox/[id]
//
// DELETE  — remove an item from the index and unlink its stored
//           content / file body.
// PATCH   — update the item's status. Currently the only supported
//           patch is { status: "waiting" } which is what "Reprocess"
//           on the queue row sends. Extend as the API grows.
// GET     — return one item + its full content (for the preview drawer
//           to load the whole body on demand rather than showing the
//           truncated previewText only).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  deleteItem,
  readIndex,
  readItemContent,
  setItemStatus,
} from "@/lib/nex/knowledge-inbox/storage";
import type { InboxStatus } from "@/lib/nex/knowledge-inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: InboxStatus[] = ["waiting", "processing", "review", "processed"];

// Next 16 dynamic route params are async — see docs.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = await deleteItem(id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let body: { status?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const status = body.status;
  if (typeof status !== "string" || !(VALID_STATUSES as string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }
  const item = await setItemStatus(id, status as InboxStatus);
  if (!item) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const items = await readIndex();
  const item = items.find((i) => i.id === id);
  if (!item) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const content = await readItemContent(item);
  return NextResponse.json({ ok: true, item, content });
}
