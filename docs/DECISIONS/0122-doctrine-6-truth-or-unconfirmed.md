# ADR-0122 · Founder Doctrine #6 · Truth or Unconfirmed

**Status:** IMMUTABLE · **Date:** 2026-09-10 · **Author:** Founder + Master AI Engineer

## The rule

> **Every claim NEX outputs is either (a) traceable to verified evidence, or (b) explicitly labeled `Unconfirmed:` (or the equivalent language variant).**
>
> **NEX never states legend, folklore, spiritual belief, unverified history, rumor, or story-as-fact as if it were factual.**

## Why

Every frontier AI system today (ChatGPT · Claude · Gemini · Perplexity · Grok) will answer questions about legends, prophecies, spiritual claims, disputed history, folk beliefs, and unverified rumors *in the same confident tone* as they answer verified facts. Users cannot tell which is which.

This is the single largest trust gap in the AI industry. The founder identified it directly:

> "For story telling or spiritual or history with no proven rock solid evidence we state that with — unconfirmed or similar so our users know that NEX is not like the other AI that will tell the user any information."

Doctrine #6 makes this an enforced architectural rule, not a prompt-engineering suggestion.

## What counts as "verified"

Only claims that trace to an evidence item with `trust_layer ∈ { canonical_verified, canonical_authoritative, canonical_official }` and a resolvable `source_reference`.

## What counts as "unconfirmed"

Anything else that NEX chooses to relay to the user. Categories that ALWAYS require the `Unconfirmed:` prefix (or language variant) unless verified evidence exists:

- Storytelling and folklore
- Spiritual claims (deities, souls, afterlife, revelations)
- Historical events without rock-solid corroboration
- Legends and myths
- Rumor and gossip
- User-supplied claims echoed back
- LLM-invented details (rescue path)
- Any claim rejected by Fabrication Gate v2 that the user has explicitly asked to hear anyway

## What NEX must NEVER do

- Present a legend, spiritual belief, or unverified history in the same confident tone as verified fact
- Omit the `Unconfirmed:` prefix on a claim that failed the Truth Engine
- Fabricate an unverified claim as verified by inventing citations
- Bury the label in fine print — it must be at the head of the affected sentence

## Language variants (mirroring Phase 19 language packs)

| Language | Prefix |
|---|---|
| en | `Unconfirmed:` |
| id | `Belum diverifikasi:` |
| fr | `Non vérifié:` |
| es | `Sin verificar:` |
| de | `Unbestätigt:` |
| ja | `未確認:` |
| zh | `未经证实:` |
| pt | `Não verificado:` |
| it | `Non verificato:` |
| ar | `غير مؤكد:` |

## Where it applies in the codebase

1. **Response composer** — every rendered sentence passes through the unconfirmed-labeler
2. **Chat-with-tools envelope** — response carries `unconfirmed_claim_count` for observability
3. **NEX Trust Score** — unconfirmed claims contribute proportionally to a lower score
4. **Public evidence pages** — a claim's evidence page shows `verified: true|false`; when false, the page prominently states the reason
5. **Vision, file, voice, code doctrines** — all five modality doctrines already say "never establishes truth"; Doctrine #6 is the enforcement that makes the label visible to the user

## Composition with existing doctrines

| Doctrine | Rule | Relation to #6 |
|---|---|---|
| #1 LLM rescue never bypasses Truth Engine | Model-generated content is provisional | Rescue claims that survive Fabrication Gate but lack evidence → **prefixed** by #6 |
| #2 LLM never executes action without NEX auth | Model cannot invoke tools autonomously | Actions never become claims → orthogonal |
| #3 Vision/file/web capped at evidence_provisional | Provisional never becomes verified | Provisional claims echoed to user → **prefixed** by #6 |
| #4 Memory informs context, does not establish truth | Memory never becomes evidence | Memory-derived claims → **prefixed** by #6 |
| #5 Untrusted content never becomes instructions | Injection defence | Sanitiser blocks injection; residual unverified content → **prefixed** by #6 |
| **#6 Truth or Unconfirmed** | **All remaining claims must be labeled** | **This is the label enforcer** |

Doctrine #6 is the **last-mile enforcer**. Every other doctrine gates *what enters* NEX. Doctrine #6 gates *what exits* NEX to the user.

## Measurable acceptance

- `scripts/smoke-doctrine-6.mjs` proves:
  - A verified-evidence-backed reply carries **no** `Unconfirmed:` prefix
  - A reply about a legend/spiritual topic without evidence carries `Unconfirmed:` at the head of every affected sentence
  - Language variant is honored when user's `preferred_language` is set
  - `unconfirmed_claim_count` field is present in every `chat-with-tools` response
  - The public reply envelope's `doctrine_note` names Doctrine #6

## What this doctrine enables

> "**NEX is the only AI where you know when it is guessing.**"

This sentence becomes a durable marketing line. It is defensible against every frontier competitor because every one of them, on the day of this ADR, presents rumor as fact using the same tone as it presents verified events.

## Immutability

This ADR is IMMUTABLE. It cannot be softened, weakened, or exempted for any surface or vertical. Every response NEX renders — chat, API, voice, share link, evidence page — carries the labeler.
