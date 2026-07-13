// Storage cleanup helper — extracts the storage path from a public
// URL and calls storage.remove() so orphaned uploads don't
// accumulate forever.
//
// Public URLs from Supabase Storage look like:
//   https://<ref>.supabase.co/storage/v1/object/public/network-uploads/{path}
// The {path} portion is what remove() takes.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "network-uploads";

/** Parses a public storage URL back to the {path} inside the bucket.
 *  Returns null when the URL doesn't match our bucket's shape (so we
 *  never accidentally issue removes against unrelated URLs). */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const path = url.slice(idx + marker.length);
  return decodeURIComponent(path.split("?")[0]);
}

/** Deletes one or more objects from network-uploads by their public
 *  URLs. Non-network URLs are silently skipped. Returns the number of
 *  paths that were actually submitted for delete. */
export async function deleteStorageObjects(urls: string[]): Promise<number> {
  const paths = urls
    .map(pathFromPublicUrl)
    .filter((p): p is string => p !== null);
  if (paths.length === 0) return 0;
  const res = await supabaseAdmin.storage.from(BUCKET).remove(paths);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[uploads.server.deleteStorageObjects] remove failed", res.error);
    return 0;
  }
  return paths.length;
}
