// POST /api/nex-coding-chat/attach · multipart/form-data · field=file
// Accepts a single file <= 200 KB · refuses executable extensions and
// content with critical security signatures · writes to
// data/nex-coding-chat/transit/attachments/<sha256>.<ext> plus a sidecar
// metadata JSON. Returns the SHA-256 handle the client (chat UI) can then
// cite in a subsequent /message call.
//
// GET /api/nex-coding-chat/attach · lists metadata for saved attachments.

import { NextResponse } from "next/server";
import { saveAttachment, listAttachments, MAX_ATTACHMENT_BYTES } from "@/lib/nex-coding-chat/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }
  const entry = fd.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing 'file' field" }, { status: 400 });
  }
  if (entry.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { ok: false, error: `file exceeds ${MAX_ATTACHMENT_BYTES} bytes` },
      { status: 413 },
    );
  }
  const buf = Buffer.from(await entry.arrayBuffer());
  const receipt = saveAttachment(entry.name, buf, entry.type || "application/octet-stream");
  return NextResponse.json(receipt, { status: receipt.ok ? 200 : 400 });
}

export async function GET() {
  const items = listAttachments();
  return NextResponse.json({ ok: true, attachments: items, count: items.length });
}
