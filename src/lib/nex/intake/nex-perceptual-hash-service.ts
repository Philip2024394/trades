// NEX Perceptual Hash Service · NEX-OWNED INTERFACE.
//
// Perceptual hashing catches near-duplicates that exact content-hashing
// misses (same photo re-encoded · re-cropped · slightly compressed).
// NEX-owned interface · pluggable implementation.

export interface NexPerceptualHashRequest {
  imageBytes?: Buffer;
  imageUrl?: string;
  mimeType?: string;
}

export interface NexPerceptualHashResponse {
  provider: string;
  extractedAt: string;
  /** Hex-encoded perceptual hash (typically 16 chars for 64-bit pHash). */
  hash: string;
  algorithm: "pHash" | "dHash" | "aHash" | "none";
}

export interface NexPerceptualHashService {
  readonly name: string;
  compute(req: NexPerceptualHashRequest): Promise<NexPerceptualHashResponse | null>;
}
