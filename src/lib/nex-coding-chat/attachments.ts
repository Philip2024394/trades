// NEX Coding Chat · attachment storage
// Founder uploads an image / small doc from the workstation input tray.
// We save it deterministically under data/nex-coding-chat/transit/attachments/
// keyed by SHA-256, refuse dangerous extensions, refuse content with critical
// security signatures, and cap at the CODE_STANDARDS.json 200 KB limit.
//
// External engines (NEX1 · MAI · watcher processes) can then reference the
// attachment by its SHA in the InboxPayload without needing to shuttle bytes.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { scanContent } from "@/lib/nex-security/scanner";

const REPO_ROOT = process.cwd();
const ATTACH_DIR = path.join(REPO_ROOT, "data", "nex-coding-chat", "transit", "attachments");

export const MAX_ATTACHMENT_BYTES = 200_000;

// Executable extensions the workstation never persists. Extension list is not
// a security guarantee (attackers can rename), but it stops accidental
// double-click execution and the content scanner catches embedded payloads.
export const REFUSED_EXTENSIONS: readonly string[] = [
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".vbs",
  ".ps1",
  ".sh",
  ".jar",
];

const TEXT_MIMES = /^(?:text\/|application\/(?:json|javascript|typescript|xml|x-sh|x-ts|x-tsx))/i;
const TEXT_EXTS = new Set([
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".xml",
  ".csv",
  ".log",
]);

export interface AttachmentReceipt {
  readonly ok: boolean;
  readonly sha256?: string;
  readonly bytes?: number;
  readonly ext?: string;
  readonly mime?: string;
  readonly rel_path?: string;
  readonly refused_reason?: string;
}

export interface AttachmentMetadata {
  readonly sha256: string;
  readonly original_name: string;
  readonly mime: string;
  readonly size: number;
  readonly ext: string;
  readonly saved_at: string;
}

export function saveAttachment(original_name: string, buf: Buffer, mime: string): AttachmentReceipt {
  if (buf.length === 0) {
    return { ok: false, refused_reason: "attachment is empty" };
  }
  if (buf.length > MAX_ATTACHMENT_BYTES) {
    return { ok: false, refused_reason: `attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes (got ${buf.length})` };
  }

  const raw_ext = path.extname(original_name).toLowerCase();
  if (REFUSED_EXTENSIONS.includes(raw_ext)) {
    return { ok: false, refused_reason: `executable extension not permitted: ${raw_ext}` };
  }
  // Normalise extension · limit to alphanumeric to prevent path shenanigans.
  const safe_ext = /^\.[a-z0-9]{1,10}$/.test(raw_ext) ? raw_ext : ".bin";

  // Content scan for anything text-shaped.
  if (TEXT_MIMES.test(mime) || TEXT_EXTS.has(safe_ext)) {
    const text = buf.toString("utf8");
    const scan = scanContent(`data/nex-coding-chat/transit/attachments/${original_name}`, text, buf);
    const critical = scan.hits.filter((h) => h.severity === "critical");
    if (critical.length > 0) {
      return {
        ok: false,
        refused_reason: `content contains critical security signature: ${critical[0]!.pattern_id} at line ${critical[0]!.line_number}`,
      };
    }
  }

  if (!existsSync(ATTACH_DIR)) mkdirSync(ATTACH_DIR, { recursive: true });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const filename = `${sha256}${safe_ext}`;
  const abs = path.join(ATTACH_DIR, filename);

  // Idempotent: if already stored with the same SHA, skip re-write.
  if (!existsSync(abs)) {
    const tmp = abs + ".tmp";
    writeFileSync(tmp, buf);
    renameSync(tmp, abs);
  }

  const meta: AttachmentMetadata = {
    sha256,
    original_name,
    mime,
    size: buf.length,
    ext: safe_ext,
    saved_at: new Date().toISOString(),
  };
  writeFileSync(abs + ".meta.json", JSON.stringify(meta, null, 2), "utf8");

  return {
    ok: true,
    sha256,
    bytes: buf.length,
    ext: safe_ext,
    mime,
    rel_path: `data/nex-coding-chat/transit/attachments/${filename}`,
  };
}

export function readAttachmentMetadata(sha256: string): AttachmentMetadata | null {
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;
  if (!existsSync(ATTACH_DIR)) return null;
  for (const f of readdirSync(ATTACH_DIR)) {
    if (f.startsWith(sha256) && f.endsWith(".meta.json")) {
      try {
        return JSON.parse(readFileSync(path.join(ATTACH_DIR, f), "utf8")) as AttachmentMetadata;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function listAttachments(): readonly AttachmentMetadata[] {
  if (!existsSync(ATTACH_DIR)) return [];
  const out: AttachmentMetadata[] = [];
  for (const f of readdirSync(ATTACH_DIR)) {
    if (!f.endsWith(".meta.json")) continue;
    try {
      out.push(JSON.parse(readFileSync(path.join(ATTACH_DIR, f), "utf8")) as AttachmentMetadata);
    } catch {
      /* skip malformed */
    }
  }
  return out.sort((a, b) => (a.saved_at < b.saved_at ? 1 : -1));
}
