# NEX Lab · Autonomous Research Environment

**See ADR-0304** for the full architecture.

**Do NOT commit any file under this directory to git.** All Lab data is local, experimental, and rebuildable.

## What lives here

```
demands/     · ranked user asks (from conversation ledger + knowledge_gap)
concepts/    · 16-field specs drafted by lab_concept_prototyper
harvest/     · raw per-domain incoming data (accommodation/food/transport/business/activities)
verified/    · facts that passed 2+ source cross-check
prototypes/  · UI mockups per concept
reports/     · weekly + on-demand founder briefs
promotions/  · signed promotion events + rollback SQL
models/      · cached ONNX embedding models (never committed)
pending-external/  · external API requests awaiting founder approval (never auto-execute)
snapshots/   · nightly snapshots of nex.conversation_message for lab_demand_observer
```

## Boundary rules

- Nothing here reaches `nex.*` in Postgres without a founder-signed promotion event.
- Nothing here reaches the main NEX UI without a founder-signed promotion event.
- Lab agents CANNOT call external LLM APIs (blocked by `src/lib/nex/lab/internet-gate.ts`).
- Kill switch at `data/nex-lab-runtime/lab-stop-override.json` halts every lab agent within 60 s.

## Status

- **2026-09-10:** Scaffold shipped. Awaiting founder authorization on 3 gates in ADR-0304 §10 before agent build starts.
