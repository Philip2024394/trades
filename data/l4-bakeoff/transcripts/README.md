# V.5.4.3 · L4 Bakeoff Transcript Sink

**Founder authorization 2026-09-08** · this directory is the durable transcript sink for V.5.4.3 controlled-instrument runs.

## Discipline (enforced)

- **Gitignored** — see `.gitignore` at repo root · this directory MUST NOT enter version control
- **No secrets** — transcripts contain only what `TranscriptRecord` (see `src/lib/nex/l4-bakeoff/controlled-instrument.ts`) permits: request_id · case_id · candidate_id · prompt · system_prompt · response text/kind · latency · token counts · captured_at_iso. No API keys · no personal data · no owner credentials · no `credentials.jsonl` content
- **No uncontrolled permanent conversation logging** — records are per-controlled-instrument-run only · not runtime chat logs · Founder-authorization-scoped
- **Append-only** — `FilesystemTranscriptSink` enforces content-hash idempotency (Op-Truth §OP.5) · same content re-write no-op · content-drift REFUSED
- **Path-traversal-safe** — sink only accepts `[A-Za-z0-9_.-]+` request_ids

## Structure

```
transcripts/
├── qwen3-8b/                          # sink_id per candidate
├── qwen3-14b/
├── llama-3.1-8b/
├── gemma-3-9b/
├── phi-4-14b/
├── deepseek-r1-distill-qwen-14b/
└── mistral-small-24b/
```

Each subdirectory receives one `<request_id>.json` file per L4 bakeoff case (92 cases × 7 candidates = 644 records per corpus round).

## Retention

Retention policy has NOT been formalized yet (pre-V.5.4.3 hardening TBD). For now: records persist indefinitely. Redaction/rotation hook is a documented pre-production add.

## What NOT to add here

- Not runtime chat transcripts
- Not user conversations
- Not conversations from any non-L4-bakeoff surface
- Not any secret material
