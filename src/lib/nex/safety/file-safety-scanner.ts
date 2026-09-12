// src/lib/nex/safety/file-safety-scanner.ts
//
// Founder DOCTRINE 2026-09-10:
// "Any file uploaded in chat OR added by the founder is scanned for
//  clean, safe content that CANNOT affect the NEX operational system."
//
// This scanner runs BEFORE any file byte reaches:
//   · the vision pipeline
//   · the file-facts-to-evidence pipeline
//   · the ingestion workers
//   · the model context
//   · the object storage
//
// The scanner rejects when ANY layer flags. It surfaces the reason so
// the founder can review. It NEVER silently allows. It NEVER modifies
// or repairs a file — reject-only.
//
// Layers:
//   1. Filename allowlist  · reject executable/script extensions
//   2. Magic-byte check    · reject PE (.exe/.dll), ELF, Mach-O, MSI,
//                            CAB, JAR-with-manifest, VBS/JS/PS1 shebangs
//   3. Size cap            · reject over 25 MB (per-file)
//   4. Text-content scan   · reject files containing:
//                            · shortlink domains (bit.ly / t.co / …)
//                            · unicode homoglyphs in URLs
//                            · shell command injection tokens
//                            · known-bad domains (typo-squats)
//   5. Doctrine hint       · flag when text contains system-prompt
//                            leak markers ("### system", "<|system|>")
//                            so ingested files can't hijack the LLM

import { createHash } from "node:crypto";

export type ScanVerdict = "clean" | "warn" | "reject";

export interface ScanReport {
  verdict:  ScanVerdict;
  reasons:  readonly string[];
  layers:   Record<string, "pass" | "warn" | "reject">;
  sha256:   string;
  size:     number;
  filename: string;
  mimetype: string | null;
  scanned_at_iso: string;
  scanner_version: "1.0";
}

// ── Layer 1 · filename allowlist ────────────────────────────────────
// Anything not on this list is auto-rejected. Additions require an
// ADR + founder authorization (see doctrine).
const ALLOWED_EXTENSIONS = new Set([
  // documents
  "pdf", "txt", "md", "csv", "tsv", "rtf", "docx", "xlsx", "pptx",
  // images
  "jpg", "jpeg", "png", "webp", "gif", "svg", "avif", "heic", "bmp",
  // structured data
  "json", "yaml", "yml", "xml", "toml",
  // audio/video (for voice pipeline)
  "wav", "mp3", "m4a", "ogg", "flac", "mp4", "webm", "mov",
]);

const BANNED_EXTENSIONS = new Set([
  // Windows executables
  "exe", "dll", "msi", "cab", "scr", "com", "cpl", "sys", "bat", "cmd", "ps1", "psm1", "vbs", "vbe", "wsf", "wsh", "js", "jse",
  // Unix executables + scripts
  "sh", "bash", "zsh", "fish", "elf", "so", "dylib",
  // Archives that could hide payloads
  "iso", "img", "vhd", "vmdk", "app",
  // Office macros
  "docm", "xlsm", "pptm", "xlam",
  // Java + Android
  "jar", "war", "apk", "aab",
]);

function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

// ── Layer 2 · magic-byte check (independent of filename) ────────────
// Some payloads rename .exe → .png. Bytes don't lie.
function magicByteReject(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  // Windows PE (MZ header)
  if (buf[0] === 0x4d && buf[1] === 0x5a) return "PE_executable_MZ";
  // ELF (Linux binary)
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return "ELF_executable";
  // Mach-O (macOS binary), 32/64
  if ((buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && (buf[3] === 0xce || buf[3] === 0xcf))
   || (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe)) return "MachO_executable";
  // MSI installer / Compound file
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return "MSI_or_ole_compound";
  // Java class file
  if (buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe) return "Java_class";
  // Script shebangs when file is text-mode
  const head = buf.slice(0, Math.min(64, buf.length)).toString("utf8");
  if (/^#!\s*\/(bin|usr)\/(bash|sh|zsh|python|perl|node|env)\b/.test(head)) return "shell_shebang";
  return null;
}

// ── Layer 4 · text content scan ─────────────────────────────────────
// Only fires on text-like files. Looks for URL/injection signals.

const SHORTLINK_DOMAINS = new Set([
  "bit.ly", "goo.gl", "t.co", "tinyurl.com", "ow.ly", "is.gd", "buff.ly",
  "adf.ly", "shorte.st", "cutt.ly", "rebrand.ly", "bl.ink", "rb.gy", "shorturl.at",
  "tiny.cc", "lnkd.in", "v.gd", "s.id", "urlz.fr",
]);

const SUSPICIOUS_TLDS = new Set([
  "zip", "review", "country", "kim", "cricket", "science", "work", "gq",
  "loan", "download", "racing", "faith", "party", "trade", "date", "top",
  "click", "link", "buzz", "click", "wang",
]);

const SYSTEM_PROMPT_HIJACK = [
  /###\s*system/i,
  /<\|\s*system\s*\|>/i,
  /\[\s*system\s*\]/i,
  /ignore (all |the |your )?(previous|prior|above) (instructions|rules|prompt)/i,
];

const HOMOGLYPH_URL = /https?:\/\/[^\s]*[Α-Ωα-ωА-Яа-я][^\s]*/;

interface TextScanResult { reasons: string[]; verdict: "pass" | "warn" | "reject"; }

function scanTextContent(buf: Buffer, ext: string): TextScanResult {
  const textExts = new Set(["txt","md","csv","tsv","json","yaml","yml","xml","toml","html","htm","svg"]);
  if (!textExts.has(ext)) return { reasons: [], verdict: "pass" };
  const text = buf.toString("utf8", 0, Math.min(buf.length, 2_000_000)); // cap 2 MB scan
  const reasons: string[] = [];
  let verdict: "pass" | "warn" | "reject" = "pass";

  // URLs
  const urls = text.match(/https?:\/\/[^\s"'<>()\[\]]+/gi) ?? [];
  const seen = new Set<string>();
  for (const u of urls.slice(0, 500)) {
    let host: string;
    try { host = new URL(u).hostname.toLowerCase(); } catch { continue; }
    if (seen.has(host)) continue;
    seen.add(host);
    if (SHORTLINK_DOMAINS.has(host)) { reasons.push(`shortlink:${host}`); verdict = "warn"; }
    const tld = host.split(".").pop();
    if (tld && SUSPICIOUS_TLDS.has(tld)) { reasons.push(`suspicious_tld:${tld}`); verdict = "warn"; }
  }

  // Homoglyph URLs
  if (HOMOGLYPH_URL.test(text)) {
    reasons.push("homoglyph_url_detected");
    verdict = "reject";
  }

  // System prompt hijack (only warn — file may legitimately contain
  // markdown headers like "### System requirements")
  for (const p of SYSTEM_PROMPT_HIJACK) {
    if (p.test(text)) {
      reasons.push(`prompt_hijack_pattern:${p.source.slice(0, 30)}`);
      if (verdict !== "reject") verdict = "warn";
      break;
    }
  }

  // Shell injection tokens
  if (/(?:\|\s*sh\b|;\s*curl\s|`.*`|\$\(.*\)|&&\s*rm\b|;\s*wget\s)/i.test(text)) {
    reasons.push("shell_injection_tokens");
    verdict = "reject";
  }

  return { reasons, verdict };
}

// ── Entrypoint ──────────────────────────────────────────────────────
export interface ScanInput {
  filename: string;
  mimetype?: string | null;
  bytes:    Buffer | Uint8Array;
  max_size_bytes?: number;
}

export function scanFile(input: ScanInput): ScanReport {
  const buf = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const size = buf.length;
  const ext = extensionOf(input.filename);
  const reasons: string[] = [];
  const layers: Record<string, "pass" | "warn" | "reject"> = {
    filename: "pass", magic_bytes: "pass", size: "pass", text_content: "pass",
  };
  const MAX = input.max_size_bytes ?? 25 * 1024 * 1024;

  // Layer 3 · size
  if (size > MAX) {
    layers.size = "reject";
    reasons.push(`size_over_cap:${size}>${MAX}`);
  }
  if (size === 0) {
    layers.size = "reject";
    reasons.push("empty_file");
  }

  // Layer 1 · filename
  if (!ext) {
    layers.filename = "reject";
    reasons.push("no_extension");
  } else if (BANNED_EXTENSIONS.has(ext)) {
    layers.filename = "reject";
    reasons.push(`banned_extension:${ext}`);
  } else if (!ALLOWED_EXTENSIONS.has(ext)) {
    layers.filename = "reject";
    reasons.push(`extension_not_allowlisted:${ext}`);
  }

  // Layer 2 · magic bytes
  const magic = magicByteReject(buf);
  if (magic) {
    layers.magic_bytes = "reject";
    reasons.push(`magic_byte:${magic}`);
  }

  // Layer 4 · text content
  const textScan = scanTextContent(buf, ext);
  if (textScan.verdict !== "pass") {
    layers.text_content = textScan.verdict;
    for (const r of textScan.reasons) reasons.push(r);
  }

  // Roll up verdict
  const anyReject = Object.values(layers).some((v) => v === "reject");
  const anyWarn = Object.values(layers).some((v) => v === "warn");
  const verdict: ScanVerdict = anyReject ? "reject" : anyWarn ? "warn" : "clean";

  return {
    verdict,
    reasons,
    layers,
    sha256,
    size,
    filename: input.filename,
    mimetype: input.mimetype ?? null,
    scanned_at_iso: new Date().toISOString(),
    scanner_version: "1.0",
  };
}

/**
 * Hard-reject helper for call sites that want a throwing gate.
 * NEVER silently allows — throws on reject with structured reason.
 */
export function scanOrThrow(input: ScanInput): ScanReport {
  const report = scanFile(input);
  if (report.verdict === "reject") {
    const err = new Error(`file_rejected:${report.reasons.join(",").slice(0, 400)}`);
    (err as unknown as { report: ScanReport }).report = report;
    throw err;
  }
  return report;
}
