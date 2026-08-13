// KPE Stage 3 · Normalisation Engine
//
// Standardises structural elements so downstream stages (Chunking,
// Metadata, Classification) can rely on a canonical form.
//
// Normalises:
//   · Heading levels (# / ## / ### / #### · dashed underline → #)
//   · Bullet lists (-, *, • → -)
//   · Numbered lists (1) / 1. / (1) → 1.)
//   · Quotation marks (curly → straight)
//   · Fenced code blocks (``` / ~~~ → ```)
//   · Table separators kept intact for Chunking to recognise

import type { NormalisationInput, NormalisationOutput, PipelineStage } from "../types";

function normaliseHeadings(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? "";
    // Setext-style: "Title" followed by "===" or "---"
    if (/^={3,}\s*$/.test(next) && line.trim().length > 0) {
      out.push(`# ${line.trim()}`);
      i += 1;
      continue;
    }
    if (/^-{3,}\s*$/.test(next) && line.trim().length > 0 && !line.startsWith("|")) {
      out.push(`## ${line.trim()}`);
      i += 1;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function normaliseBullets(s: string): string {
  return s.split("\n").map((line) => {
    return line.replace(/^(\s*)[•*·](\s+)/, "$1-$2");
  }).join("\n");
}

function normaliseNumbering(s: string): string {
  return s.split("\n").map((line) => {
    return line
      .replace(/^(\s*)\((\d+)\)(\s+)/, "$1$2.$3")
      .replace(/^(\s*)(\d+)\)(\s+)/, "$1$2.$3");
  }).join("\n");
}

function normaliseQuotes(s: string): string {
  return s
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'");
}

function normaliseCodeFences(s: string): string {
  return s.replace(/^~~~/gm, "```");
}

export const NormalisationStage: PipelineStage<NormalisationInput, NormalisationOutput> = {
  name: "normalisation",
  version: "1.0.0",
  async run(input: NormalisationInput): Promise<NormalisationOutput> {
    let s = input.cleaned_content;
    s = normaliseHeadings(s);
    s = normaliseBullets(s);
    s = normaliseNumbering(s);
    s = normaliseQuotes(s);
    s = normaliseCodeFences(s);
    return { normalised_content: s };
  },
};
