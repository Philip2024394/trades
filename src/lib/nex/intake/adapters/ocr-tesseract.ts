// NEX OCR adapter · Tesseract via tesseract.js (pure WASM · no external service).
//
// Task #69 · 2026-08-22 · Philip greenlit dual-adapter build (Option 1).
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22 (NEX-owned · provider-pluggable)
//   · ADR-0044 (zero third-party AI · Tesseract runs entirely locally in-process)
//   · ADR-0027 (confidence never claims 100 · always leave room)
//
// Complements vision-qwen25vl.ts. Qwen handles perception + large/marketing text.
// Tesseract handles the small/dense/technical text Qwen 3B cannot resolve
// (blueprint annotations · product labels · dense receipts). Both run behind
// their own NEX-owned interfaces · consumers pick whichever answers.
//
// Runtime characteristics:
//   · No GPU · pure CPU WASM
//   · English + Indonesian language packs downloaded on first use (~15 MB each,
//     cached in node_modules/tesseract.js/... after first run)
//   · Typical inference: ~1-5s per image
//   · No RAM impact worth flagging (small vocabulary tries · WASM heap ~200 MB peak)
//
// Never modifies:
//   · NexOcrService interface (unchanged shape)
//   · UNREADABLE gate in concept-extractor.ts (returns null on any failure)
//   · admin promotion flow
//   · never-auto-teach doctrine

import type {
  NexOcrRequest,
  NexOcrResponse,
  NexOcrService,
} from "../nex-ocr-service";

const CONFIDENCE_CEILING = 95;

// Minimum text length worth returning. Tesseract sometimes emits a single
// stray character on noise. Below this threshold we treat as no-text.
const MIN_MEANINGFUL_TEXT_LEN = 2;

// Default language pack · English. Indonesian added when caller supplies
// languages: ["eng", "ind"] via NexOcrRequest.
const DEFAULT_LANGUAGES = ["eng"];

// Worker cache · one worker per language combination. Language pack download
// only happens on first use per combo · subsequent calls reuse the worker.
// Kept module-level so the whole Node.js process shares one warm instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerCache = new Map<string, Promise<any>>();

async function getWorker(languages: string[]) {
  const key = [...languages].sort().join("+");
  const cached = workerCache.get(key);
  if (cached) return cached;
  // Lazy import so tesseract.js doesn't load during Next dev startup for
  // routes that don't need OCR.
  const p = (async () => {
    const { createWorker } = await import("tesseract.js");
    return createWorker(key);
  })();
  workerCache.set(key, p);
  try {
    return await p;
  } catch (err) {
    // Failed to create · evict so next call retries fresh.
    workerCache.delete(key);
    throw err;
  }
}

async function acquireInput(req: NexOcrRequest): Promise<Buffer | string> {
  if (req.imageBytes) return req.imageBytes;
  if (req.imageUrl) {
    const r = await fetch(req.imageUrl);
    if (!r.ok) throw new Error(`fetch failed: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("neither imageBytes nor imageUrl supplied");
}

export const ocrTesseract: NexOcrService = {
  name: "tesseract",

  async extract(req: NexOcrRequest): Promise<NexOcrResponse | null> {
    try {
      const languages =
        Array.isArray(req.languages) && req.languages.length > 0
          ? req.languages
          : DEFAULT_LANGUAGES;

      const input = await acquireInput(req);
      const worker = await getWorker(languages);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (worker as any).recognize(input);

      const text = String(data?.text ?? "").trim();
      if (text.length < MIN_MEANINGFUL_TEXT_LEN) {
        return null;
      }

      const rawConfidence =
        typeof data?.confidence === "number" ? data.confidence : 0;
      const confidence = Math.max(
        0,
        Math.min(CONFIDENCE_CEILING, Math.round(rawConfidence)),
      );

      return {
        provider: this.name,
        providerVersion: "tesseract.js",
        extractedAt: new Date().toISOString(),
        text,
        confidence,
      };
    } catch {
      // Any failure at all → null → concept-extractor treats as no-OCR-evidence.
      // Adapter never throws · never fabricates · never partial-succeeds silently.
      return null;
    }
  },
};
