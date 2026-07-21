// ImageKit → Supabase Storage auto-migration.
//
// Any video URL pointing at ik.imagekit.io is downloaded then
// uploaded to the networkers-tv-videos bucket. Returns the new
// Supabase URL. Idempotent: if the file already exists in the
// bucket, updates in place (upsert).
//
// Called from:
//   • /api/videos/create — every new upload passes through this
//     so ImageKit is a temporary transit URL, not the permanent
//     home
//   • Manual admin backfill script for legacy videos
//
// Cost note: this transfers up to 100MB per video through the
// Vercel function's egress. For very large libraries (500+ videos)
// a background job would be preferable. For our current scale
// (dozens of videos) inline is fine.

const IMAGEKIT_HOST         = "ik.imagekit.io";
const DEFAULT_VIDEO_BUCKET  = "networkers-tv-videos";
const DEFAULT_IMAGE_BUCKET  = "networkers-tv-thumbnails";
const MAX_MIGRATE_BYTES     = 200 * 1024 * 1024;   // 200MB safety cap

export type MigrateResult =
  | { ok: true;  publicUrl: string; sizeBytes: number; migrated: true }
  | { ok: true;  publicUrl: string; sizeBytes: number; migrated: false }   // already Supabase
  | { ok: false; error: string };

/** True when the URL is an ImageKit-hosted asset that we want to move. */
export function isImageKitUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.host === IMAGEKIT_HOST || u.host.endsWith("." + IMAGEKIT_HOST);
  } catch {
    return false;
  }
}

/** True when the URL is already served from Supabase Storage. */
export function isSupabaseStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.host.endsWith(".supabase.co") && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

/** Derive a clean filename from the ImageKit URL for the storage
 *  key. Falls back to a hash + extension when the URL has no
 *  useful path. */
function keyFromUrl(url: string, titleHint?: string): string {
  try {
    const u        = new URL(url);
    const last     = decodeURIComponent(u.pathname.split("/").pop() ?? "video.mp4");
    const cleaned  = last
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (cleaned.length > 3) return cleaned;
  } catch { /* fall through */ }
  const stem = (titleHint ?? "video")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem}-${Date.now()}.mp4`;
}

/** Generic ImageKit → Supabase Storage migration. Works for any
 *  asset kind (video, image, PDF, etc.) — supply the bucket + MIME.
 *  Video + image wrappers below are convenience shortcuts. */
async function migrateImageKitAsset(
  sourceUrl: string,
  opts:      {
    bucket:       string;
    contentType:  string;   // 'video/mp4', 'image/png', 'image/jpeg', ...
    titleHint?:   string;
    storageKey?:  string;
  }
): Promise<MigrateResult> {
  if (!sourceUrl || typeof sourceUrl !== "string") {
    return { ok: false, error: "empty-url" };
  }
  if (isSupabaseStorageUrl(sourceUrl)) {
    return { ok: true, publicUrl: sourceUrl, sizeBytes: 0, migrated: false };
  }
  if (!isImageKitUrl(sourceUrl)) {
    return { ok: true, publicUrl: sourceUrl, sizeBytes: 0, migrated: false };
  }

  const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return { ok: false, error: "supabase-env-missing" };
  }

  // Download
  let arrayBuffer: ArrayBuffer;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return { ok: false, error: `imagekit-fetch-${res.status}` };
    arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_MIGRATE_BYTES) {
      return { ok: false, error: `file-too-large-${arrayBuffer.byteLength}b` };
    }
  } catch (e) {
    return { ok: false, error: "download-failed:" + (e instanceof Error ? e.message : String(e)) };
  }

  // Upload
  const key = opts.storageKey ?? keyFromUrl(sourceUrl, opts.titleHint);
  try {
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${opts.bucket}/${key}`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type":  opts.contentType,
          "x-upsert":      "true"
        },
        body: arrayBuffer
      }
    );
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      return { ok: false, error: `supabase-upload-${uploadRes.status}: ${body.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, error: "upload-failed:" + (e instanceof Error ? e.message : String(e)) };
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${opts.bucket}/${key}`;
  return { ok: true, publicUrl, sizeBytes: arrayBuffer.byteLength, migrated: true };
}

/** Video convenience wrapper — networkers-tv-videos bucket, video/mp4. */
export async function migrateImageKitVideoUrl(
  sourceUrl: string,
  opts:      { titleHint?: string; storageKey?: string } = {}
): Promise<MigrateResult> {
  return migrateImageKitAsset(sourceUrl, {
    bucket:      DEFAULT_VIDEO_BUCKET,
    contentType: "video/mp4",
    titleHint:   opts.titleHint,
    storageKey:  opts.storageKey
  });
}

/** Image convenience wrapper — networkers-tv-thumbnails bucket.
 *  Content-type inferred from the URL extension. */
export async function migrateImageKitImageUrl(
  sourceUrl: string,
  opts:      { titleHint?: string; storageKey?: string; bucket?: string } = {}
): Promise<MigrateResult> {
  const ext         = sourceUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "png";
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
                    : ext === "webp" ? "image/webp"
                    : ext === "gif"  ? "image/gif"
                    : "image/png";
  return migrateImageKitAsset(sourceUrl, {
    bucket:      opts.bucket ?? DEFAULT_IMAGE_BUCKET,
    contentType,
    titleHint:   opts.titleHint,
    storageKey:  opts.storageKey
  });
}
