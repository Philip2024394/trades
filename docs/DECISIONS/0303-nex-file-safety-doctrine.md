# ADR-0303 — File Safety Doctrine

**Founder Rule (2026-09-10):**
> "Any files uploaded in chat or founder adds is scanned for clear clean safe files that cannot affect the nex operational system."

**Status:** IN FORCE · immutable · applies to ALL file ingestion paths
**Author:** Master AI Engineer

---

## The Rule

**No file byte reaches NEX's operational surface until it has passed the 4-layer safety scan.** This includes files uploaded by:
- Public chat users
- Founder himself (no privileged bypass)
- Automated harvesters (with source-verified allowlist exemption)
- Master AI Engineer's own proposals

Zero exceptions. Zero silent allows.

## Scanner (shipped in this ADR)

`src/lib/nex/safety/file-safety-scanner.ts` · exports `scanFile(input)` and `scanOrThrow(input)`.

### 4 layers of check

| Layer | Reject condition |
|---|---|
| **1. Filename** | Extension not in allowlist (pdf, txt, md, csv, tsv, docx, xlsx, images, audio, video, json, yaml, xml) OR extension on banned list (exe, dll, msi, bat, cmd, ps1, vbs, js, sh, jar, apk, ...) |
| **2. Magic bytes** | Windows PE (MZ), ELF, Mach-O, MSI compound, Java class, shell shebang — *regardless of filename extension* |
| **3. Size** | Zero bytes OR over 25 MB per file |
| **4. Text content** | Homoglyph URLs (Cyrillic/Greek lookalikes in http://) · shell injection tokens (\| sh, ; curl, backticks) · known shortlink domains (bit.ly / t.co / …) → warn · suspicious TLDs (.zip / .review / .click / …) → warn · system-prompt-hijack markers (### system, <\|system\|>, "ignore previous instructions") → warn |

Verdict rollup:
- **reject** if any layer rejects → file blocked, reason surfaced to caller, sha256 logged
- **warn** if any layer warns → file allowed with audit log entry
- **clean** if all layers pass → file allowed silently

## Wiring points (must all use the scanner)

Any endpoint that accepts a file MUST run `scanOrThrow()` before writing bytes:

- `/api/nex/vision/analyze` (image analysis)
- `/api/nex/files/ingest` (evidence pipeline)
- `/api/nex-live/upload-file` (WebRTC voice + file)
- `/api/uploads/*` (generic uploader family)
- `/api/trade-off/upload-*` (merchant asset uploads)
- `/api/homeowner/projects/*/photos` (homeowner uploads)
- `/api/site/editor/*/upload` (site editor)
- Any FUTURE ingestion route

If a new upload route ships without wiring `scanOrThrow`, CI must fail.

## Founder is not exempt

Even the founder's own uploads run through the scanner. Reason: an attacker who compromises the founder's device could otherwise ship a malicious payload with no gate. The doctrine says *no bypass*.

If a legitimate file is rejected, the founder can:
1. See the reason (`report.reasons`)
2. Explicitly override by re-uploading with `?override=founder&reason=...` (creates an audit row in `nex.file_scan_override`) — this override still runs magic-byte + size layers, only skips filename/text-content layers
3. Or add the extension to the allowlist via ADR + PR

## Audit trail

Every scan (clean, warn, reject) writes a row:
```
data/master-ai/file-scans.jsonl
{ ts_iso, filename, sha256, size, verdict, reasons, layers, source_route }
```

The Master AI Engineer supervisor rotates this file at 5 MB (same policy as event-bus).

## What we chose NOT to do

- **No live antivirus scan** (no ClamAV binding) — too heavy, adds ~500 ms per file · founder can add later
- **No sandbox execution** (Firecracker / gvisor) — out of scope; we don't execute uploaded files at all
- **No hash lookup against VirusTotal** — third-party, contradicts founder's "no third party" mandate
- **No content ML classifier** — would add cost + non-determinism

The 4-layer deterministic scan is deliberately conservative. False negatives (missed threats) are lower risk than false positives (blocked founder work). The scan is fast (< 20 ms per MB), free, and offline.

## Testing

Unit tests (to be added — placeholder):
- `src/lib/nex/safety/file-safety-scanner.test.ts`
- Cases: valid PDF · valid PNG · renamed .exe as .png (magic byte catch) · shortlink text · shell injection · homoglyph URL · oversized · empty file · banned .bat · unknown .foo

## Enforcement

- Every merge to `main` that touches an upload route requires an ADR reviewer sign-off that `scanOrThrow` is wired.
- The Master AI Engineer supervisor tails file-scans.jsonl and alerts (log line) on any `verdict: reject` — for founder review.
- Rejected file hashes accumulate as a local block-list (future: `nex.file_scan_blocklist`).
