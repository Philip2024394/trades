// Studio media — client-safe types + helpers.
//
// Kept out of mediaLoader.ts so client components (media library grid,
// image picker modal) can import the types without dragging
// supabaseAdmin into the client bundle.

export type StudioMediaItem = {
  id: string;
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

/** 5 MB — same cap as the existing upload-photo endpoint so merchants
 *  get consistent feedback across every image field in the product. */
export const STUDIO_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
