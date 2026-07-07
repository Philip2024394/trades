// Watermark registry — server-side loader/writer for the
// watermark_images + watermark_incidents tables.

import { createClient } from "@supabase/supabase-js";
import type { WatermarkTier } from "./config";

export type WatermarkImage = {
  imageId: string;
  originalAhash: string;
  latestOutputAhash: string | null;
  currentTier: WatermarkTier;
  appliedLayers: Record<string, string[]>;
};

export type WatermarkIncident = {
  id: string;
  imageId: string;
  foundAtUrl: string;
  detectionMethod: string;
  distance: number;
  status: "open" | "dmca_sent" | "resolved" | "ignored";
  createdAt: string;
  resolvedAt: string | null;
  notes: string | null;
};

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Upsert an image's watermark registration. */
export async function registerImage(
  imageId: string,
  originalAhash: string,
  outputAhash: string,
  tier: WatermarkTier,
  appliedLayers: string[]
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  // Merge tier → layers into the JSONB map so we keep history for
  // each tier's layer set.
  const { data: existing } = await client
    .from("watermark_images")
    .select("applied_layers")
    .eq("image_id", imageId)
    .maybeSingle();
  const nextLayers = {
    ...((existing?.applied_layers as Record<string, string[]>) ?? {}),
    [tier]: appliedLayers
  };
  const { error } = await client.from("watermark_images").upsert(
    {
      image_id: imageId,
      original_ahash: originalAhash,
      latest_output_ahash: outputAhash,
      current_tier: tier,
      applied_layers: nextLayers
    },
    { onConflict: "image_id" }
  );
  return !error;
}

export async function loadImage(
  imageId: string
): Promise<WatermarkImage | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("watermark_images")
    .select("*")
    .eq("image_id", imageId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    imageId: data.image_id,
    originalAhash: data.original_ahash,
    latestOutputAhash: data.latest_output_ahash,
    currentTier: data.current_tier,
    appliedLayers: data.applied_layers ?? {}
  };
}

/** Search for images with an aHash close to the given hash. Used by
 *  the reverse-image monitor when it finds a suspected repost. */
export async function findByAhash(
  ahash: string,
  maxDistance = 10
): Promise<Array<{ imageId: string; ahash: string; distance: number }>> {
  const client = getClient();
  if (!client) return [];
  // We could push distance computation to Postgres via a UDF, but for
  // a catalogue of ≤10,000 images the roundtrip + JS compute is fine.
  const { data, error } = await client
    .from("watermark_images")
    .select("image_id, original_ahash");
  if (error || !data) return [];
  const hamming = (a: string, b: string) => {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      while (xor > 0) {
        diff += xor & 1;
        xor >>= 1;
      }
    }
    return diff;
  };
  const rows = data
    .map((r) => ({
      imageId: r.image_id as string,
      ahash: r.original_ahash as string,
      distance: hamming(r.original_ahash as string, ahash)
    }))
    .filter((r) => r.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
  return rows;
}

export async function logIncident(
  imageId: string,
  foundAtUrl: string,
  detectionMethod: string,
  distance: number,
  notes?: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.from("watermark_incidents").insert({
    image_id: imageId,
    found_at_url: foundAtUrl,
    detection_method: detectionMethod,
    distance,
    status: "open",
    notes: notes ?? null
  });
  return !error;
}
