// AI agreement extractor.
//
// Foreman photographs a scribbled site-note ("Dave — kitchen carcass —
// £2,400 — £800 deposit — start 15 Aug — finish 22 Aug") or a
// WhatsApp screenshot. Claude Vision returns structured engagement
// fields.

import "server-only";

export type AgreementExtraction = {
  hired_display_name: string | null;
  hired_trade: string | null;
  service_description: string | null;
  agreed_price_pence: number | null;
  deposit_pence: number | null;
  agreed_start_date: string | null; // YYYY-MM-DD
  agreed_end_date: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

const EMPTY: AgreementExtraction = {
  hired_display_name: null,
  hired_trade: null,
  service_description: null,
  agreed_price_pence: null,
  deposit_pence: null,
  agreed_start_date: null,
  agreed_end_date: null,
  confidence: "low",
  notes: null
};

const SYSTEM_PROMPT = `You extract site-hire agreements from photos of
handwritten notes, whiteboards, or WhatsApp screenshots.

Return ONLY valid JSON matching this shape:

{
  "hired_display_name": string | null,      // "Dave" or "Dave the Carpenter"
  "hired_trade": "carpenter"|"electrician"|"plumber"|"roofer"|"plasterer"|"tiler"|"bricklayer"|"joiner"|"painter"|"landscaper"|"scaffolder"|"other" | null,
  "service_description": string | null,     // "Kitchen carcass install + worktop cut"
  "agreed_price_pence": number | null,      // integer pence (£2400 -> 240000)
  "deposit_pence": number | null,
  "agreed_start_date": "YYYY-MM-DD" | null,
  "agreed_end_date": "YYYY-MM-DD" | null,
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

Rules:
- Dates written like "15 Aug" default to the current or next year based on context; be explicit YYYY-MM-DD.
- If you cannot see the field, use null. Never invent.
- Handwritten inputs are typically medium confidence at best.`;

export async function extractAgreement(input: {
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<
  | { ok: true; ai_configured: true; extraction: AgreementExtraction }
  | { ok: true; ai_configured: false; extraction: AgreementExtraction }
  | { ok: false; error: string }
> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ok: true, ai_configured: false, extraction: EMPTY };
  }
  if (!input.mimeType.startsWith("image/")) {
    return { ok: false, error: "unsupported_mime_type" };
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
                text: "Extract the agreement fields. JSON only."
              }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return {
        ok: false,
        error: `anthropic_${res.status}: ${detail.slice(0, 200)}`
      };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    const cleaned = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: Partial<AgreementExtraction>;
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
