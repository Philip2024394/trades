// NEX OCR Service · NEX-OWNED INTERFACE.
//
// Same NEX-owned pattern as NexVisionService. OCR is a NEX capability with
// a replaceable implementation. Consumers use this interface only.

export interface NexOcrRequest {
  imageBytes?: Buffer;
  imageUrl?: string;
  mimeType?: string;
  /** Language hints. Default is english; Indonesian supported when adapter has language pack. */
  languages?: string[];   // e.g. ["eng", "ind"]
}

export interface NexOcrResponse {
  provider: string;
  providerVersion?: string;
  extractedAt: string;
  /** The raw text extracted from the image, if any. */
  text: string;
  /** Confidence 0-100 · provider's self-reported. */
  confidence?: number;
  /** Non-fatal warnings. */
  warnings?: string[];
}

export interface NexOcrService {
  readonly name: string;
  /** OCR an image. Returns null if provider cannot handle it. */
  extract(req: NexOcrRequest): Promise<NexOcrResponse | null>;
}
