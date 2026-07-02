// Draft-layout encoding — client-safe helpers.
//
// Kept OUT of layoutLoader.ts because layoutLoader imports supabaseAdmin
// (server-only), and the editor's client bundle needs encodeDraftParam
// to build the initial iframe src. Splitting the pure functions here
// means both server and client can share the same wire format without
// dragging a server-only module across the boundary.

import type { StudioLayoutJson } from "./schema";

export function encodeDraftParam(layout: StudioLayoutJson): string {
  const json = JSON.stringify(layout);
  if (typeof Buffer !== "undefined") {
    // Node / server bundle.
    return Buffer.from(json, "utf8").toString("base64");
  }
  // Browser bundle. btoa handles ASCII cleanly; wrap the JSON through
  // encodeURIComponent + a byte-safe transform so non-ASCII field values
  // (e.g. curly quotes, ×, £) don't blow up btoa.
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeDraftParam(
  raw: string | undefined
): StudioLayoutJson | null {
  if (!raw) return null;
  try {
    let decoded: string;
    if (typeof Buffer !== "undefined") {
      decoded = Buffer.from(raw, "base64").toString("utf8");
    } else {
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      decoded = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(decoded) as unknown;
    if (isStudioLayoutJson(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

function isStudioLayoutJson(v: unknown): v is StudioLayoutJson {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { sections?: unknown }).sections) &&
    Array.isArray((v as { rows?: unknown }).rows)
  );
}
