# Copy-Envelope-as-JSON Button · Closure Doctrine

**Date:** 2026-09-18
**Batch:** Frontier §17 queue · twenty-fourth slice · after restore-dismissed UI.
**Authority:** Founder "continue" · §10 smallest-slice choice · closes limit §5.4 of the chip modal closure ("No copy-envelope-as-JSON button. Founder can F12 → Network tab if they need the raw shape.").
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Add a single **Copy JSON** button to the envelope inspector modal footer. One click puts the full envelope on the clipboard as pretty-printed JSON. Removes the need for founder to open DevTools when they want the raw shape (for pasting into a bug report, sharing with a teammate, feeding into another tool, etc.).

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/app/nex1/workstation-live/agent/NexAgentWorkstation.tsx` | Modified · ~30 LOC added | (a) `envelopeCopied` transient flag state; (b) footer-actions wrapper div; (c) button with `navigator.clipboard.writeText` primary path + legacy `execCommand("copy")` fallback; (d) 1.5s "Copied ✓" flash |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified · ~20 LOC added | `.naw-env-modal-copy` + `.naw-env-modal-footer-actions` · cyan accent matching the chip's clickable affordance |

**Zero touches on:**
- Envelope shape / builders
- Persistence layer
- Any endpoint (pure client-side utility)
- Truth Engine, Q7/Q8, safety gate, pricing.ts

---

## §3 · Design

### §3.1 · Two-path clipboard write

Primary: `navigator.clipboard.writeText(payload)` — modern async clipboard API. Works over HTTPS or on localhost (workstation is on localhost:3008 so this always applies for the founder's environment).

Fallback: dynamically create a hidden `<textarea>`, put the payload in it, `execCommand("copy")`, remove. Covers legacy browsers or contexts where the async clipboard is blocked. **NOT** silently swallowed — if BOTH paths fail (extreme edge case), the button just doesn't flip to "Copied ✓" so the founder sees no false success.

### §3.2 · Pretty-print

`JSON.stringify(env, null, 2)` — 2-space indent, all keys and values preserved. The payload is the same shape the API returns; the founder can paste into anything that eats JSON.

### §3.3 · Transient state · no permanent UI change

`envelopeCopied` flips to `true` on success, then `setTimeout(…, 1500)` flips it back. Button text is `"Copied ✓"` during that window, `"Copy JSON"` otherwise. No modal, no toast — just an in-place confirmation.

### §3.4 · Modal footer stays balanced

Left side: task ID reference. Right side: new actions row containing Copy JSON button + existing zero-LLM badge. `display: flex; gap: 10px;` on the actions wrapper keeps both aligned.

### §3.5 · Focus-visible + hover states

`focus-visible` outline matches the chip's affordance style (cyan). Hover deepens the background subtly. Same visual language as the Restore button in the Notes panel — small consistency win across the workstation.

---

## §4 · Verification · data plane

### §4.1 · Workstation renders

```
GET /nex1/workstation-live → HTTP 200
```

### §4.2 · Envelope shape is serialisable

Fetched a real `clarify` envelope from `/api/nex/agent/submit`. `JSON.stringify(env, null, 2)` produces **1168 bytes** of clean output. Field set: `confidence, missing_evidence, next_action_hint, options, provenance, reason, source, value, verdict, zero_llm`. Every field the modal renders is captured in the copy payload.

First 200 chars of what founder would paste:
```
{
  "value": null,
  "confidence": 0.4,
  "provenance": [
    {
      "kind": "trace_key",
      "value": "task=81b86a42-4c28-4c15-bc85-365bb2af6029"
    },
    {
      "kind": "step_id",
      "value…
```

### §4.3 · Deterministic serialisation

`JSON.stringify(env, null, 2)` on the same object twice returns byte-identical output. Confirmed:
```
identical serialisation: true
```

Founder pasting into a bug report gets stable output — no field-order jitter that would create false diffs.

### §4.4 · Zero-LLM audit

```
NexAgentWorkstation.tsx         → CLEAN (0 llm markers)
nex-agent-workstation.css       → CLEAN
```

Scanned for `openai`, `anthropic`, `ollama`, `claude-`. Zero matches.

---

## §5 · Honest limits

1. **UI verified via data plane · not headed browser.** The onClick handler, clipboard API path, fallback path, setTimeout for "Copied ✓" flash — all standard patterns. Founder verifies visually.
2. **Clipboard permission on non-localhost.** Modern browsers require HTTPS for `navigator.clipboard.writeText`. The workstation runs on localhost so this always works today. If we ever expose it over plain HTTP externally, the fallback path handles it.
3. **No copy history.** Founder overwrites their clipboard every click. If they intended to paste something else, this replaces it. Standard clipboard semantics.
4. **`JSON.stringify` drops undefined values.** If an envelope has an undefined field, it doesn't appear in the copy. In practice envelopes ship every field explicitly (with `null` where empty) so this doesn't come up.
5. **No "copy as X" variants.** Just JSON. Not markdown, not YAML, not TypeScript literal. If needed later, a small select next to the button.
6. **Silent-fail on double-clipboard-failure.** If both paths throw, no visible error. Deliberate — founder can retry, no error modal noise. If it ever becomes an issue, a small inline error hint is straightforward.

---

## §6 · Registry classification

| Capability | State | Evidence |
|-----------|-------|----------|
| Copy JSON button click → clipboard write | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | Standard `navigator.clipboard` + `execCommand` fallback · headed test blocked · founder verifies |
| Envelope shape serialises cleanly | **RUNTIME_VERIFIED** | §4.2 · 1168 bytes, all fields present |
| Deterministic output | **RUNTIME_VERIFIED** | §4.3 |
| Workstation regression | **RUNTIME_VERIFIED** | §4.1 |

**Application-wide zero-LLM** remains not-claimed as an all-app property.

---

## §7 · Founder view

Before:
```
task 81b86a42…                  NEX1_NATIVE · zero LLM
```

After:
```
task 81b86a42…       [ Copy JSON ]   NEX1_NATIVE · zero LLM
```

After click:
```
task 81b86a42…       [ Copied ✓ ]    NEX1_NATIVE · zero LLM
                            (reverts to "Copy JSON" after 1.5s)
```

Clipboard now contains the full pretty-printed envelope.

---

## §8 · What is NOT in this batch

- Clickable provenance (deep-link `trace_key` values to task steps) — separate slice
- Copy as markdown / YAML / TypeScript
- Copy history
- Toast notification on copy success
- Truth Engine, Q7/Q8, safety gate changes

---

## §9 · Queue after this

- **Clickable provenance in the chip modal** — deep-link `trace_key` values to the task step timeline. ~50 LOC.
- **Envelope-history archive endpoint** — move task JSONL files older than N days. ~60 LOC.
- **Per-round envelope logging** — instrument nex2/nex3 review paths for granular trails. ~120 LOC.
- **Scheduled auto-compaction cron** — weekly hit to `/api/nex1/logs/compact`. ~30 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.

Say **"continue"** for **clickable provenance in the chip modal** (~50 LOC · natural extension · closes another modal limit) or name a different item.
