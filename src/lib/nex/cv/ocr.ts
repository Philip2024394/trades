// Document OCR — receipts, invoices, certificates, delivery notes.
// Every extracted field carries a confidence so callers know when
// to double-check numbers before writing them into the ledger.

import { reviewImage } from "@/lib/openai/vision";
import { cacheKey, getCached, setCached } from "./cache";
import { OCR_PROMPT, OCR_SYSTEM } from "./prompts";
import { DISCLAIMERS, evidenceFor, type Confidence, type OCRResult } from "./types";

type ModelOCR = {
  summary?:       unknown;
  document_kind?: unknown;
  fields?:        unknown;
  raw_text?:      unknown;
};

export type ExtractDocumentInput = {
  imageUrl: string;
  hint?:    string;
};

export async function extractDocument(input: ExtractDocumentInput): Promise<OCRResult> {
  const key = cacheKey(input.imageUrl, "ocr", { hint: input.hint });
  const cached = getCached<OCRResult>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision (OCR prompt)", []);

  const res = await reviewImage<ModelOCR>({
    system:   OCR_SYSTEM,
    prompt:   input.hint ? `${OCR_PROMPT} User note: ${input.hint}` : OCR_PROMPT,
    image:    { url: input.imageUrl },
    jsonMode: true
  });

  if (!res)        return emptyOCR(evidence, "no_vision_key");
  if (!res.parsed) return emptyOCR(evidence, "model_failed");

  const m = res.parsed;
  const result: OCRResult = {
    summary:       typeof m.summary === "string" && m.summary ? m.summary : "Document extracted.",
    document_kind: kindOf(m.document_kind),
    fields:        normaliseFields(m.fields),
    raw_text:      typeof m.raw_text === "string" ? m.raw_text : undefined,
    disclaimer:    DISCLAIMERS.ocr,
    evidence
  };
  setCached(key, result);
  return result;
}

function kindOf(v: unknown): OCRResult["document_kind"] {
  const allowed = ["receipt", "invoice", "certificate", "delivery_note", "risk_assessment", "other"] as const;
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as OCRResult["document_kind"];
  return "unknown";
}

function normaliseFields(v: unknown): OCRResult["fields"] {
  if (!Array.isArray(v)) return [];
  const out: OCRResult["fields"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key   = typeof o.key === "string" ? o.key : "";
    const value = typeof o.value === "string" ? o.value : "";
    if (!key || !value) continue;
    out.push({ key, value, confidence: confidenceOf(o.confidence) });
  }
  return out;
}

function confidenceOf(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function emptyOCR(evidence: ReturnType<typeof evidenceFor>, err: string): OCRResult {
  return {
    summary:       err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — can't read the document right now."
      : "OCR analysis didn't produce a usable response.",
    document_kind: "unknown",
    fields:        [],
    disclaimer:    DISCLAIMERS.ocr,
    evidence,
    error:         err
  };
}
