// src/lib/nex/live-chat-completion/image-gen/index.ts
//
// Founder Phase 8 · Image Generation env-selected default + provenance writer.
//
// Selection precedence:
//   NEX_IMAGE_GEN=off                → null (feature disabled)
//   NEX_IMAGE_GEN_PROVIDER=mock      → mock provider (regression · deterministic)
//   otherwise                        → real SD-webui provider (localhost:7860)

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { makeMockImageGenProvider } from "./mock-provider";
import { makeSdImageGenProvider } from "./sd-provider";
import type { ImageGenProvider, ImageGenResult } from "./contract";

export function makeDefaultImageGenProvider(): ImageGenProvider | null {
  const enabled = process.env.NEX_IMAGE_GEN;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  const kind = (process.env.NEX_IMAGE_GEN_PROVIDER ?? "sd").toLowerCase();
  if (kind === "mock") return makeMockImageGenProvider();
  return makeSdImageGenProvider();
}

/**
 * Persist one row per generated image to nex.generated_image.
 * Fire-and-forget · never crashes the generation path on DB error.
 * Called after a successful (or failed) generate() call.
 */
export function persistGeneratedImages(
  result: ImageGenResult,
  conversation_id: string | null,
  pool: Pool = getKnowledgeFactoryDbPool(),
): void {
  const _writesEnabled = (process.env.NEX_IMAGE_GEN_PERSIST ?? "on") !== "off";
  if (!_writesEnabled || result.images.length === 0) return;
  void (async () => {
    try {
      for (const img of result.images) {
        const rawBytes = Buffer.from(img.content_base64, "base64").length;
        await pool.query(
          `INSERT INTO nex.generated_image
            (image_id, ref_id, content_hash, provider, model_id, prompt,
             negative_prompt, width, height, seed, bytes, mime_type,
             safety_verdict, conversation_id, generated_at, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), $15)`,
          [
            randomUUID(), img.ref_id, img.content_hash, result.provider, result.model_id,
            result.prompt, result.negative_prompt, img.width, img.height, img.seed,
            rawBytes, img.mime_type, result.safety_verdict, conversation_id, result.request_ms,
          ],
        );
      }
    } catch { /* swallow · provenance is observability · never crashes generation */ }
  })();
}

export { makeMockImageGenProvider, makeSdImageGenProvider };
