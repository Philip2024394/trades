// Background removal configuration — where the model weights live,
// how big the input tensor is, and where processed outputs go.
//
// Everything is self-hosted in Supabase Storage. No third-party CDNs.
// Merchant browsers fetch the model ONCE (cached forever via
// service-worker + HTTP cache), then all inference happens locally.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://msdonkkechxzgagyguoe.supabase.co";

/** Public URL of the RMBG-1.4 ONNX weights hosted in our Supabase
 *  Storage bucket. RMBG-1.4 (Bria AI, Apache-2.0) — one of the
 *  strongest open-license models available for background removal
 *  as of 2026. Total download: ~176MB, cached across sessions. */
export const RMBG_MODEL_URL =
  `${SUPABASE_URL}/storage/v1/object/public/bgremoval-models/rmbg-1.4.onnx`;

/** Optional 44MB quantized variant. Slight quality loss (~2% IoU
 *  on hair edges) but 4× smaller download for mobile-first
 *  merchants. Not used by default. */
export const RMBG_QUANTIZED_URL =
  `${SUPABASE_URL}/storage/v1/object/public/bgremoval-models/rmbg-1.4-quantized.onnx`;

/** Input tensor size the model expects. Any source image is resized
 *  to 1024×1024 before inference, then the output mask is upscaled
 *  back to the original resolution. */
export const INPUT_SIZE = 1024;

/** Bucket + path prefix for uploaded outputs. Server-side write
 *  under `<merchantSlug>/<uuid>.png`. */
export const OUTPUT_BUCKET = "bgremoval-outputs";

/** Per-tier monthly quota. Since inference cost is ZERO (client-
 *  side), this is a fair-use signal, not a cost gate. */
export const MONTHLY_QUOTA: Record<string, number> = {
  standard:  5,     // Free — enough to try
  app_trial: 10,
  starter:   20,
  app_paid:  50,    // Pro
  verified:  200,   // Business
  works:     10_000 // Effectively unlimited
};

/** Rolling 24h anti-scrape cap regardless of tier. Kills the
 *  "one merchant script pulls 1000 images overnight" attack. */
export const ROLLING_24H_CAP = 100;
