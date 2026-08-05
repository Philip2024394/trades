// POST /api/nex/knowledge-inbox/upload
//
// Multipart file upload for the Drag & Drop, Voice Notes, and Image
// Analysis capture surfaces. Body must be multipart/form-data with:
//
//   source        the KnowledgeSource label
//   forcedKind    optional — "voice" or "image" (from those surfaces)
//   files         one or more File entries (repeated form field)
//
// Each file is hashed (sha256), deduplicated against existing hashes,
// and written to data/knowledge-inbox/files/<id>-<safeName>. Returns
// the list of created items and any that were treated as duplicates.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { coerceSource, saveFileItem } from "@/lib/nex/knowledge-inbox/storage";
import type { InboxKind, InboxItem } from "@/lib/nex/knowledge-inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function coerceKind(input: FormDataEntryValue | null): InboxKind | undefined {
  if (input === "voice" || input === "image" || input === "file") return input;
  return undefined;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("[knowledge-inbox.upload] formData parse failed:", err);
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const source = coerceSource(form.get("source"));
  const forcedKind = coerceKind(form.get("forcedKind"));
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "no_files" }, { status: 400 });
  }

  const created: InboxItem[] = [];
  const duplicates: InboxItem[] = [];
  for (const f of files) {
    try {
      const bytes = Buffer.from(await f.arrayBuffer());
      const { item, deduplicated } = await saveFileItem({
        source,
        forcedKind,
        originalFilename: f.name || "upload",
        mimeType: f.type || "application/octet-stream",
        bytes,
      });
      if (deduplicated) duplicates.push(item);
      else created.push(item);
    } catch (err) {
      console.error("[knowledge-inbox.upload] file save failed:", err);
      // Continue with the rest of the files rather than failing the whole batch.
    }
  }

  return NextResponse.json({ ok: true, created, duplicates });
}
