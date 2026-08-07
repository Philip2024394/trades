// NEX Data Import Wizard · row-level validation
//
// Runs during dry-run + on every real commit. Every issue is a per-row
// record with a stable code the UI can render. In-file duplicates use a
// pass over normalized (email, phone) keys.

import { canonicalEmail, canonicalPhone } from "@/lib/nex/contacts/identity";
import { applyMappingToRow } from "./mapping";
import type { ColumnMapping, ValidationIssue } from "./types";

export type ValidationResult = {
  invalid_rows: ValidationIssue[];
  in_file_duplicates: number;
  empty_rows: number;
  unknown_columns: string[];
};

export function validateRows(
  header: string[],
  dataRows: string[][],                    // NOT including the header
  mapping: ColumnMapping,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let empty_rows = 0;
  const seen = new Map<string, number[]>();     // dedup key → row indices that share it
  const unknownColumns = header.filter((h) => (mapping[h.trim()] ?? "attribute") === "attribute" && h.trim().length > 0);

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 1;                     // 1-based data row · header is row 0
    const values = dataRows[i];

    // Empty row detection
    if (!values.some((v) => v && v.trim().length > 0)) {
      empty_rows += 1;
      issues.push({ row_index: rowIndex, field: null, code: "empty_row", detail: "row is entirely blank" });
      continue;
    }

    const { mapped } = applyMappingToRow(header, values, mapping);
    const email = mapped.email;
    const phone = mapped.phone;

    if (!email && !phone) {
      issues.push({ row_index: rowIndex, field: null, code: "missing_required", detail: "row has no email and no phone · cannot be upserted" });
      continue;
    }

    if (email && !canonicalEmail(email)) {
      issues.push({ row_index: rowIndex, field: "email", code: "invalid_email", detail: `"${email}" does not look like a valid email address` });
    }
    if (phone && !canonicalPhone(phone)) {
      issues.push({ row_index: rowIndex, field: "phone", code: "invalid_phone", detail: `"${phone}" is too short or malformed to be a phone number` });
    }

    // In-file duplicate detection: canonical email OR canonical phone match
    const dedupKey = canonicalEmail(email) ?? canonicalPhone(phone);
    if (dedupKey) {
      const arr = seen.get(dedupKey) ?? [];
      arr.push(rowIndex);
      seen.set(dedupKey, arr);
    }
  }

  let in_file_duplicates = 0;
  for (const [key, indices] of seen.entries()) {
    if (indices.length > 1) {
      in_file_duplicates += indices.length - 1;
      for (let n = 1; n < indices.length; n++) {
        issues.push({
          row_index: indices[n],
          field: null,
          code: "in_file_duplicate",
          detail: `same identifier (${key}) also appears at row ${indices[0]}`,
        });
      }
    }
  }

  for (const col of unknownColumns) {
    issues.push({
      row_index: 0,                              // 0 = applies to all rows / header-level
      field: col,
      code: "unknown_column",
      detail: `column "${col}" has no canonical mapping · will land in attributes["${col}"] at import time (or set to "ignore" to skip it)`,
    });
  }

  return { invalid_rows: issues, in_file_duplicates, empty_rows, unknown_columns: unknownColumns };
}
