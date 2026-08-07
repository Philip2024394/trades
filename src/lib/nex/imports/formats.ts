// NEX Data Import Wizard · format detection + parsers
//
// CSV + TSV in Phase 3b.6b.1 · XLSX / JSON in Phase 3b.6c.
// Zero dependencies · every parser handles quoted values + escaped quotes
// + LF/CRLF. Header row is always row 0 of the returned rows[][].

import type { FileFormat } from "./types";

export function detectFormat(content: string, fileName?: string | null): FileFormat {
  const nameLower = (fileName ?? "").toLowerCase();
  if (nameLower.endsWith(".csv")) return "csv";
  if (nameLower.endsWith(".tsv") || nameLower.endsWith(".tab")) return "tsv";
  if (nameLower.endsWith(".xlsx")) return "xlsx";
  if (nameLower.endsWith(".json")) return "json";

  // Content-based detection: sample the first non-empty line.
  const sample = content.split(/\r?\n/, 5).find((l) => l.trim().length > 0) ?? "";
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  if (tabs > 0 && tabs > commas) return "tsv";
  if (commas > 0) return "csv";
  if (sample.trim().startsWith("[") || sample.trim().startsWith("{")) return "json";
  return "unknown";
}

/**
 * Generic delimiter-separated parser. Handles quoted values, escaped
 * double-quotes ("" inside a quoted field), LF or CRLF endings.
 */
export function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === delimiter) { row.push(field); field = ""; i += 1; continue; }
    if (ch === "\r") { i += 1; continue; }
    if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseCsv(input: string): string[][] {
  return parseDelimited(input, ",");
}

export function parseTsv(input: string): string[][] {
  return parseDelimited(input, "\t");
}

/**
 * Front-door parser: dispatches by format · returns rows[][] with the
 * header at row 0. Throws on unsupported format · caller catches and
 * marks the session state as "failed".
 */
export function parse(content: string, format: FileFormat): string[][] {
  switch (format) {
    case "csv": return parseCsv(content);
    case "tsv": return parseTsv(content);
    case "xlsx":
    case "json":
      throw new Error(`[nex-imports] ${format} parsing arrives in Wizard v2 · Phase 3b.6c`);
    case "unknown":
      throw new Error("[nex-imports] format could not be detected · pass explicit format or use a supported file extension (.csv, .tsv)");
  }
}
