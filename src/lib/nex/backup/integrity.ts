// Backup integrity — SHA-256 helpers.
// Every file in the ZIP is hashed at write time. Restore recomputes
// and refuses to proceed if a hash mismatches (silent corruption or
// tampered backup would fail loud).

import { createHash } from "node:crypto";

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256String(s: string): string {
  return sha256Buffer(Buffer.from(s, "utf-8"));
}

/** Compute sha256 for every file in a { path → content } map.
 *  Used at manifest-write time. */
export function computeIntegrity(files: Record<string, string | Buffer>): Record<string, { sha256: string; size_bytes: number }> {
  const out: Record<string, { sha256: string; size_bytes: number }> = {};
  for (const [path, content] of Object.entries(files)) {
    const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    out[path] = { sha256: sha256Buffer(buf), size_bytes: buf.length };
  }
  return out;
}

/** Verify a { path → buffer } map against a manifest's integrity block.
 *  Returns list of files that mismatched. Empty array = all clean. */
export function verifyIntegrity(
  files:     Record<string, Buffer>,
  integrity: Record<string, { sha256: string; size_bytes: number }>
): Array<{ file: string; expected: string; actual: string; expected_size?: number; actual_size?: number }> {
  const problems: Array<{ file: string; expected: string; actual: string; expected_size?: number; actual_size?: number }> = [];
  for (const [file, expected] of Object.entries(integrity)) {
    const buf = files[file];
    if (!buf) {
      problems.push({ file, expected: expected.sha256, actual: "MISSING", expected_size: expected.size_bytes, actual_size: 0 });
      continue;
    }
    const actual = sha256Buffer(buf);
    if (actual !== expected.sha256 || buf.length !== expected.size_bytes) {
      problems.push({ file, expected: expected.sha256, actual, expected_size: expected.size_bytes, actual_size: buf.length });
    }
  }
  return problems;
}
