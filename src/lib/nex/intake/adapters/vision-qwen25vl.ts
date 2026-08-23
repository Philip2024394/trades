// NEX Vision adapter · Qwen2.5-VL 3B via local Ollama.
//
// Task #69 · 2026-08-22 · Philip greenlit dual-adapter build (Option 1).
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22 (NEX-owned · provider-pluggable)
//   · project_nex_visual_intelligence_architecture_2026_08_22 (structured object model · NOT prose)
//   · ADR-0044 (zero third-party AI · every call must go to a local endpoint)
//   · ADR-0027 (confidence never claims 100 · always leave room)
//
// This adapter is the FIRST real implementation behind NexVisionService.
// The stub returned null; this returns actual pixel-derived observations.
//
// Contract preserved · never modifies:
//   · NexVisionService interface (unchanged · same signature as stub)
//   · UNREADABLE gate in concept-extractor.ts (returns null on any failure ·
//     concept-extractor cascades to UNREADABLE per its own rules · never weakened here)
//   · admin promotion flow (this adapter never touches DB)
//   · never-auto-teach doctrine (produces evidence only · consumed downstream)
//
// Verified capability boundary (2026-08-22 probes on RTX 2050 · 4 GB VRAM):
//   ✅ Object / material / colour perception on food, product, construction scenes
//   ✅ Clean structured JSON output (Ollama format:"json" mode)
//   ✅ Large / marketing text OCR (Indonesian + English handled correctly)
//   ✅ Correct "no text" detection (never invents text)
//   ❌ Small / technical text (blueprint annotations · calculator labels) →
//      Tesseract adapter (ocr-tesseract.ts) fills this gap

import sharp from "sharp";
import type {
  NexVisionRequest,
  NexVisionResponse,
  NexVisionService,
  NexVisionObservation,
} from "../nex-vision-service";

const OLLAMA_URL = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";
const MODEL = process.env.NEX_VISION_MODEL ?? "qwen2.5vl:3b";
const CHAT_PATH = "/api/chat";

// Resize policy · 2026-08-22 probe evidence · a 1024x1536 image took 212s
// cold on RTX 2050. Larger images blow past every reasonable HTTP budget.
// Capping the long edge at 1024 preserves OCR quality for signage while
// keeping warm inference at ~20s.
const MAX_LONG_EDGE = 1024;

// Confidence ceiling · ADR-0027 · never claim 100. Even if Qwen self-reports
// 100 (observed on the fruit-splash test), we cap here as the outer guard.
const CONFIDENCE_CEILING = 95;

// Timeout · cold start on this machine has been measured at 88-212s.
// Adapter tolerates up to 3 minutes so the first tick of the day survives
// route compilation + model load + inference.
const REQUEST_TIMEOUT_MS = 180_000;

// ── ADR-0044 · local-only endpoint enforcement ───────────────────────
// Mirrors the same helper in src/lib/nex/brain/providers/ollama.ts.
// Any non-local endpoint is a doctrine violation and throws immediately.
function assertLocalEndpoint(url: string): void {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  if (!isLocal) {
    throw new Error(
      `[nex-intake/vision-qwen25vl] endpoint must be local (localhost / 127.0.0.1 / *.local / ::1). Got: ${host}. NEX has a zero-third-party-AI hard rule (ADR-0044).`,
    );
  }
}

// ── Placeholder-echo defence ─────────────────────────────────────────
// 2026-08-22 probe evidence: when the schema example contains literal
// placeholder text like "exact text" / "where in image", small VLMs
// sometimes echo those placeholders back as data. This adapter's prompt
// avoids example values, but as a belt-and-braces guard we still filter
// any suspicious echo strings from parsed output.
const KNOWN_ECHO_TOKENS = new Set([
  "exact text",
  "where in image",
  "string",
  "text or empty",
  "text or empty string",
  "verbatim text",
  "example",
  "<text>",
  "<text_content>",
  "<position>",
]);

function isEcho(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  if (KNOWN_ECHO_TOKENS.has(trimmed)) return true;
  return false;
}

// ── Byte acquisition · prefer bytes when caller supplied, fetch when only URL ──
async function acquireBytes(req: NexVisionRequest): Promise<Buffer> {
  if (req.imageBytes) return req.imageBytes;
  if (req.imageUrl) {
    const r = await fetch(req.imageUrl);
    if (!r.ok) throw new Error(`fetch failed: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("neither imageBytes nor imageUrl supplied");
}

// ── Image resize · cap long edge at MAX_LONG_EDGE via sharp ──────────
async function resizeIfNeeded(bytes: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(bytes).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const long = Math.max(w, h);
    if (long <= MAX_LONG_EDGE) return bytes;
    return await sharp(bytes)
      .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside" })
      .toBuffer();
  } catch {
    // If sharp can't decode (rare for standard JPEG/PNG), return bytes as-is.
    // The downstream call still gets a chance · adapter never fails at this step.
    return bytes;
  }
}

// ── Ollama chat wire types · internal · never leak ───────────────────
type OllamaChatResponse = {
  model?: string;
  message?: { role: string; content: string };
  done?: boolean;
  done_reason?: string;
};

// ── The adapter ──────────────────────────────────────────────────────
export const visionQwen25VL: NexVisionService = {
  name: "qwen-2.5-vl-3b",

  async analyse(req: NexVisionRequest): Promise<NexVisionResponse | null> {
    try {
      assertLocalEndpoint(OLLAMA_URL);

      const originalBytes = await acquireBytes(req);
      const bytes = await resizeIfNeeded(originalBytes);
      const b64 = bytes.toString("base64");

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let resp: Response;
      try {
        resp = await fetch(`${OLLAMA_URL}${CHAT_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are NEX's visual observation adapter. Analyse the image and return ONLY a single JSON object in this exact shape:\n" +
                  '{"objects":["thing1","thing2"],"materials":["material1"],"colors":["color1"],"detected_text":"visible text or empty string","overall_confidence":0}\n' +
                  "Rules: overall_confidence 0-95 (never 100). Never invent things not visible. Never write sentences. Never repeat entries. If image is blank or unreadable return everything empty and confidence 0. Return one valid JSON object and stop.",
              },
              {
                role: "user",
                content: "Analyse this image and return the JSON.",
                images: [b64],
              },
            ],
            stream: false,
            format: "json",
            options: { temperature: 0.1, num_predict: 1024 },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (!resp.ok) return null;
      const data = (await resp.json()) as OllamaChatResponse;
      const raw = data.message?.content ?? "";
      if (!raw) return null;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }

      // Filter each list · drop echoes / non-strings / empties
      const objects = (Array.isArray(parsed.objects) ? parsed.objects : [])
        .filter((v): v is string => typeof v === "string" && !isEcho(v))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const materials = (Array.isArray(parsed.materials) ? parsed.materials : [])
        .filter((v): v is string => typeof v === "string" && !isEcho(v))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const colors = (Array.isArray(parsed.colors) ? parsed.colors : [])
        .filter((v): v is string => typeof v === "string" && !isEcho(v))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const rawText = typeof parsed.detected_text === "string" ? parsed.detected_text.trim() : "";
      const detectedText = !isEcho(rawText) ? rawText : "";

      const rawConfidence = typeof parsed.overall_confidence === "number" ? parsed.overall_confidence : 0;
      const confidence = Math.max(0, Math.min(CONFIDENCE_CEILING, Math.round(rawConfidence)));

      // Honest degradation: if we extracted nothing meaningful, return null
      // so concept-extractor's UNREADABLE cascade fires. Never invent output.
      if (objects.length === 0 && materials.length === 0 && colors.length === 0 && detectedText.length === 0) {
        return null;
      }

      const observations: NexVisionObservation[] = [
        ...objects.map((o) => ({ kind: "object" as const, value: o, confidence })),
        ...materials.map((m) => ({ kind: "attribute" as const, value: `material:${m}`, confidence })),
        ...colors.map((c) => ({ kind: "color" as const, value: c, confidence })),
      ];

      return {
        provider: this.name,
        providerVersion: MODEL,
        extractedAt: new Date().toISOString(),
        observations,
        detectedText: detectedText.length > 0 ? detectedText : undefined,
        confidence,
      };
    } catch {
      // Any failure at all → return null → UNREADABLE gate fires → admin review.
      // Adapter never throws · never fabricates · never partial-succeeds silently.
      return null;
    }
  },
};
