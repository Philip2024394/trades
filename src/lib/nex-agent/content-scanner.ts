// src/lib/nex-agent/content-scanner.ts
//
// Malware / bug / spam / secret scanner for files entering (upload) or leaving
// (export) the NEX1 Workstation. Pure functions · no external services · runs
// entirely on-server. Verdicts feed the Security Agent's `sec.*` codes.
//
// Discipline:
//   - Reject-first for RED · quarantine for AMBER · allow for GREEN
//   - Every rejection carries a specific sec.* code · never a generic reason
//   - Founder can override AMBER (not RED) via signed action

export type Verdict = "GREEN" | "AMBER" | "RED";

export interface Finding {
  readonly code: string;                // sec.* code
  readonly severity: "info" | "warn" | "critical";
  readonly detail: string;
  readonly location?: string;           // e.g. "line 12 col 4" or "byte offset 1024"
}

export interface ScanResult {
  readonly verdict: Verdict;
  readonly score: number;               // 0..100 · higher = safer
  readonly findings: readonly Finding[];
  readonly kinds_run: readonly string[];
}

// ─── Malware · polyglot · exec-header detection ──────────────────────
const MAGIC_HEADERS: ReadonlyArray<{ hex: string; kind: string; sig: string }> = [
  { hex: "4d5a",          kind: "PE executable",         sig: "MZ (Windows exe/dll)" },
  { hex: "7f454c46",      kind: "ELF executable",        sig: "\\x7fELF (Linux exec)" },
  { hex: "cafebabe",      kind: "Java class / Mach-O fat", sig: "CAFEBABE" },
  { hex: "feedface",      kind: "Mach-O executable",     sig: "FEEDFACE" },
  { hex: "504b0304",      kind: "ZIP / office archive",  sig: "PK archive" },
  { hex: "526172211a07",  kind: "RAR archive",           sig: "Rar!" },
  { hex: "377abcaf271c",  kind: "7z archive",            sig: "7z" },
  { hex: "1f8b08",        kind: "gzip",                  sig: "gzip" },
];

function bufferHead(buf: Buffer, n = 32): string {
  return buf.subarray(0, n).toString("hex").toLowerCase();
}

function scanMalware(buf: Buffer, filename: string): Finding[] {
  const findings: Finding[] = [];
  const head = bufferHead(buf);
  for (const m of MAGIC_HEADERS) {
    if (head.startsWith(m.hex)) {
      // Executables + rar are RED · zip/gzip are info (archives are legit)
      if (m.kind.includes("executable") || m.kind === "RAR archive") {
        findings.push({
          code: "sec.file_hash_malicious",
          severity: "critical",
          detail: `File magic bytes indicate ${m.kind} (${m.sig}) · executable content is not accepted`,
          location: "byte 0",
        });
      } else if (m.kind.includes("archive") && !/\.(zip|tar|gz|7z)$/i.test(filename)) {
        findings.push({
          code: "sec.polyglot_file",
          severity: "critical",
          detail: `File extension ${filename.split(".").pop()} does not match archive magic ${m.sig}`,
          location: "byte 0",
        });
      }
      break;
    }
  }
  // Polyglot detection · file starts with image/HTML magic but contains script tags
  const textHead = buf.subarray(0, Math.min(4096, buf.length)).toString("utf8");
  const isImage = /^(image|application\/pdf)/.test("") || head.startsWith("89504e47") /* PNG */ || head.startsWith("ffd8ff") /* JPEG */ || head.startsWith("47494638") /* GIF */;
  if (isImage && /<script\b|javascript:|<iframe\b/i.test(textHead)) {
    findings.push({
      code: "sec.polyglot_file",
      severity: "critical",
      detail: "Image file contains script tags · polyglot attack risk",
    });
  }
  return findings;
}

// ─── Secret scan ──────────────────────────────────────────────────────
const SECRET_PATTERNS: ReadonlyArray<{ code: string; family: string; re: RegExp }> = [
  { code: "sec.secret_leaked", family: "AWS access key",       re: /\bAKIA[0-9A-Z]{16}\b/g },
  { code: "sec.secret_leaked", family: "AWS secret",           re: /\baws[_-]?secret[_-]?access[_-]?key["'\s:=]+([A-Za-z0-9/+=]{40})/gi },
  { code: "sec.secret_leaked", family: "GitHub PAT",           re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { code: "sec.secret_leaked", family: "OpenAI key",           re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { code: "sec.secret_leaked", family: "Anthropic key",        re: /\bsk-ant-[A-Za-z0-9-]{40,}\b/g },
  { code: "sec.secret_leaked", family: "Supabase JWT",         re: /\beyJ[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\b/g },
  { code: "sec.secret_leaked", family: "Slack webhook",        re: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]{20,}/g },
  { code: "sec.secret_leaked", family: "Slack token",          re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { code: "sec.secret_leaked", family: "Google API key",       re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { code: "sec.secret_leaked", family: "Stripe secret",        re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{20,}\b/g },
  { code: "sec.secret_leaked", family: "PEM private key",      re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { code: "sec.secret_leaked", family: "SSH private key",      re: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
];

function scanSecrets(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    const m = p.re.exec(text);
    if (m) {
      findings.push({
        code: p.code,
        severity: "critical",
        detail: `Leaked ${p.family} · redact before upload/export · this file will not be accepted until removed`,
        location: `offset ~${m.index}`,
      });
    }
  }
  return findings;
}

// ─── Bug scan · high-signal patterns ─────────────────────────────────
const BUG_PATTERNS: ReadonlyArray<{ code: string; label: string; re: RegExp; severity: Finding["severity"] }> = [
  { code: "sec.bug_sql_injection_sink", label: "SQL string concat", re: /\bexecute\s*\(\s*["'`][^"'`]*\$?\{|\bquery\s*\(\s*[`"'][^`"']*\$\{/g, severity: "warn" },
  { code: "sec.bug_xss_unescaped",      label: "innerHTML assignment", re: /\.innerHTML\s*=\s*(?!["'`]<)/g, severity: "warn" },
  { code: "sec.bug_eval_use",           label: "eval() / Function() dynamic exec", re: /\beval\s*\(|new\s+Function\s*\(/g, severity: "critical" },
  { code: "sec.bug_path_traversal",     label: "Path traversal literal", re: /\.\.[\/\\]\.\.[\/\\]/g, severity: "warn" },
  { code: "sec.bug_hardcoded_creds",    label: "Hardcoded password/secret assign", re: /\b(password|passwd|api_?key|secret)\s*[:=]\s*["'][^"']{6,}["']/gi, severity: "warn" },
  { code: "sec.bug_weak_crypto",        label: "Weak crypto (MD5/SHA-1) for security", re: /createHash\s*\(\s*["'](md5|sha1)["']/gi, severity: "warn" },
  { code: "sec.bug_prototype_pollution", label: "__proto__ / constructor.prototype access", re: /\[[\"']?__proto__[\"']?\]|\bconstructor\.prototype\b/g, severity: "warn" },
];

function scanBugs(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const p of BUG_PATTERNS) {
    p.re.lastIndex = 0;
    const m = p.re.exec(text);
    if (m) {
      findings.push({
        code: p.code,
        severity: p.severity,
        detail: `Potential ${p.label} · review before proceeding`,
        location: `offset ~${m.index}`,
      });
    }
  }
  return findings;
}

// ─── Spam / bot / obfuscation scan ───────────────────────────────────
function scanSpam(text: string, mimeType: string): Finding[] {
  const findings: Finding[] = [];
  if (!text || text.length < 200) return findings;

  // Suspicious URL count
  const urls = text.match(/https?:\/\/[^\s<>"'\]]+/g) ?? [];
  if (urls.length > 20 && mimeType.startsWith("text/")) {
    findings.push({
      code: "sec.suspicious_url_count",
      severity: "warn",
      detail: `File contains ${urls.length} external URLs · unusually high for a coding file`,
    });
  }

  // Obfuscated content · high entropy, low readable-word ratio
  const words = text.match(/\b[a-zA-Z]{2,}\b/g) ?? [];
  const readableRatio = (words.join("").length) / Math.max(text.length, 1);
  if (readableRatio < 0.25 && text.length > 500) {
    findings.push({
      code: "sec.obfuscated_content",
      severity: "warn",
      detail: `Low readable-word ratio (${readableRatio.toFixed(2)}) · file may be packed / minified / obfuscated`,
    });
  }

  // Spam boilerplate detection (dumb, high-precision · matches common phishing)
  const spamSignals = [
    /viagra|cialis|casino|poker/i,
    /nigerian prince|western union|money gram/i,
    /click here to (win|claim|verify)/i,
    /suspended.*paypal.*click/i,
  ];
  const hits = spamSignals.filter((re) => re.test(text)).length;
  if (hits >= 2) {
    findings.push({
      code: "sec.spam_boilerplate",
      severity: "critical",
      detail: `Content matches ${hits} spam signal families · rejected`,
    });
  }
  return findings;
}

// ─── Scoring + verdict ───────────────────────────────────────────────
function scoreAndVerdict(findings: readonly Finding[]): { verdict: Verdict; score: number } {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 50;
    else if (f.severity === "warn") score -= 15;
    else score -= 3;
  }
  score = Math.max(0, score);
  const critical = findings.some((f) => f.severity === "critical");
  if (critical) return { verdict: "RED", score };
  if (findings.some((f) => f.severity === "warn")) return { verdict: "AMBER", score };
  return { verdict: "GREEN", score };
}

/**
 * Scan a file · returns verdict + score + findings. Runs all applicable scanners.
 */
export function scanFile(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): ScanResult {
  const { buffer, filename, mimeType } = input;
  const findings: Finding[] = [];
  const kinds: string[] = [];

  // Always malware/polyglot
  findings.push(...scanMalware(buffer, filename));
  kinds.push("malware");

  // Text-based scanners only if text-like
  const isText =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/toml" ||
    mimeType === "application/sql" ||
    /^text\//.test(mimeType);
  if (isText || buffer.length < 200_000) {
    try {
      const text = buffer.toString("utf8");
      findings.push(...scanSecrets(text));
      findings.push(...scanBugs(text));
      findings.push(...scanSpam(text, mimeType));
      kinds.push("secrets", "bugs", "spam");
    } catch { /* binary · skip text scans */ }
  }

  const { verdict, score } = scoreAndVerdict(findings);
  return { verdict, score, findings, kinds_run: kinds };
}

/**
 * Scan plain text (for export bundles etc.) · same rules minus magic-header check.
 */
export function scanText(input: { text: string; filename?: string; mimeType?: string }): ScanResult {
  const filename = input.filename ?? "export.txt";
  const mimeType = input.mimeType ?? "text/plain";
  const findings: Finding[] = [
    ...scanSecrets(input.text),
    ...scanBugs(input.text),
    ...scanSpam(input.text, mimeType),
  ];
  const { verdict, score } = scoreAndVerdict(findings);
  return { verdict, score, findings, kinds_run: ["secrets", "bugs", "spam"] };
}
