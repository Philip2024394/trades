// AI receipt/agreement extractor.
//
// Given a receipt or agreement image (bytes + mime), calls Claude Vision
// to extract structured fields. Falls back gracefully if
// ANTHROPIC_API_KEY isn't set — the caller still gets a valid response,
// with `ai_configured: false` so the UI can degrade cleanly.

import "server-only";

export type ReceiptExtraction = {
  amount_pence: number | null;
  currency: string | null;
  paid_at_iso: string | null;
  method: string | null; // "bank_transfer" | "cash" | "card" | "cheque" | null
  supplier: string | null;
  reference: string | null;
  materials_amount_pence: number | null;
  labour_amount_pence: number | null;
  vat_amount_pence: number | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

const EMPTY: ReceiptExtraction = {
  amount_pence: null,
  currency: null,
  paid_at_iso: null,
  method: null,
  supplier: null,
  reference: null,
  materials_amount_pence: null,
  labour_amount_pence: null,
  vat_amount_pence: null,
  confidence: "low",
  notes: null
};

const SYSTEM_PROMPT = `You extract payment details from receipts, bank
transfer screenshots, invoices, and handwritten site agreements for a
UK construction platform.

Return ONLY valid JSON matching this shape — no prose, no backticks:

{
  "amount_pence": number | null,       // total in pence (2400.00 GBP -> 240000)
  "currency": "GBP" | "EUR" | "USD" | null,
  "paid_at_iso": "YYYY-MM-DD" | null,
  "method": "bank_transfer" | "cash" | "card" | "cheque" | "other" | null,
  "supplier": string | null,
  "reference": string | null,
  "materials_amount_pence": number | null,
  "labour_amount_pence": number | null,
  "vat_amount_pence": number | null,
  "confidence": "high" | "medium" | "low",
  "notes": string | null                // one short sentence if useful
}

Rules:
- Convert all amounts to integer pence.
- If the image is a bank transfer, "method" is "bank_transfer".
- If handwritten (site agreement), confidence "medium" unless very clear.
- If you cannot see the field, use null. Never invent.`;

export async function extractReceipt(input: {
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<
  | { ok: true; ai_configured: true; extraction: ReceiptExtraction }
  | { ok: true; ai_configured: false; extraction: ReceiptExtraction }
  | { ok: false; error: string }
> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ok: true, ai_configured: false, extraction: EMPTY };
  }
  if (!input.mimeType.startsWith("image/") && input.mimeType !== "application/pdf") {
    return { ok: false, error: "unsupported_mime_type" };
  }
  if (input.mimeType === "application/pdf") {
    // PDF support requires Anthropic docs upload — not wired yet.
    return { ok: true, ai_configured: true, extraction: EMPTY };
  }

  const base64 = Buffer.from(input.bytes).toString("base64");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mimeType,
                  data: base64
                }
              },
              {
                type: "text",
                text: "Extract the payment / agreement details. JSON only."
              }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `anthropic_${res.status}: ${detail.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    // Strip common wrapping cases (Claude sometimes emits ```json even though instructed not to).
    const cleaned = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: Partial<ReceiptExtraction>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false, error: "invalid_json_from_model" };
    }

    return {
      ok: true,
      ai_configured: true,
      extraction: { ...EMPTY, ...parsed }
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: `network_error: ${
        err instanceof Error ? err.message : "unknown"
      }`
    };
  }
}
