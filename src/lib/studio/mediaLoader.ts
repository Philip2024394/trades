// Studio media — server-only DB loader.
//
// Kept in a separate file from media.ts so the client bundle never
// pulls supabaseAdmin transitively. Media library page + image picker
// modal both fetch through /api/studio/media on the client.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { StudioMediaItem } from "./media";

const DEFAULT_LIMIT = 200;

export async function listMerchantMedia(
  merchantId: string,
  limit = DEFAULT_LIMIT
): Promise<StudioMediaItem[]> {
  const res = await supabaseAdmin
    .from("studio_media")
    .select(
      "id, url, filename, size_bytes, mime_type, width, height, created_at"
    )
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error || !res.data) return [];

  return res.data.map(
    (r): StudioMediaItem => ({
      id: r.id as string,
      url: r.url as string,
      filename: r.filename as string,
      sizeBytes: (r.size_bytes as number) ?? 0,
      mimeType: (r.mime_type as string | null) ?? null,
      width: (r.width as number | null) ?? null,
      height: (r.height as number | null) ?? null,
      createdAt: r.created_at as string
    })
  );
}
