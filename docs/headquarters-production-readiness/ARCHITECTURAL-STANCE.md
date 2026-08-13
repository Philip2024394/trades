# NEX · Architectural Stance · Storage layer

**Status:** AUTHORITATIVE · adopted 2026-08-10 (Philip)
**Owner:** NEX Corporation · master AI engineer
**Purpose:** Fix the single sentence that answers "what is our storage architecture?" so every subsequent audit, plan, and doc reasons against the same reality.

---

## The stance

> **NEX Storage is the native storage architecture and strategic destination for NEX. Supabase remains a required legacy/current persistence dependency during the transition.**

Neither of these framings is true today:
- ❌ "Supabase is our storage."
- ❌ "NEX Storage already owns everything."

Both are current *and* wrong. Only the framing above is honest.

---

## The migration runway

**TODAY**

```
Supabase ──────────────── CURRENT · REQUIRED
   │
   ├── Brain (NEX_BRAIN_BACKEND=supabase)
   ├── Middleware (custom-domain routing)
   ├── Customer data (hammerex_*)
   └── ~40 legacy subsystems (memory · insights · feed · hero-swap · oauth · publications · story-arcs · activity · licenses · gold-path · signals · voice · vision · events · cron · …)

NEX Storage / NEX Postgres ────── BUILDING · STRATEGIC DESTINATION
   │
   ├── Object storage (nex.object_blobs · NEX_OBJECT_BACKEND=postgres)
   ├── Inbox reads (NEX_INBOX_READ_BACKEND=postgres)
   ├── Contact registry (nex.contacts)
   ├── Newer nex.* subsystems (analytics · delivery · notifications · comms-social)
   └── Future Brain (post Wave 5 flip)
```

**FUTURE**

```
NEX Storage
   │
   ├── Brain
   ├── Headquarters
   ├── Customer data
   ├── Trade systems
   ├── Workforce
   └── Applications

Supabase
   │
   └── retired subsystem by subsystem
```

---

## Scope boundaries

### In scope for the World-Class Headquarters programme
- Wave 1: Migration 046 → NEX Postgres only (Wave 5 pre-flight)
- Wave 2: W-C-COMPANION supervisor Phase 6
- Wave 3: Required production hardening (H1-H6)
- Wave 4: Verification gate matrix
- Any single legacy Supabase dependency that would block a current production gate

### Explicitly OUT of scope for the World-Class Headquarters programme
- Migrating the ~40 legacy `@supabase/supabase-js` importers to `nex.*`
- Porting the 331 `supabase/migrations/*.sql` schema to `deploy/postgres/init/`
- Rewriting middleware's custom-domain routing to NEX Postgres
- Porting `hammerex_*` customer data to `nex.*`
- Any subsystem-by-subsystem cutover that does not block a current WAVE 1–4 gate

**These are Phase C work** — the multi-quarter programme that gradually retires Supabase subsystem-by-subsystem. Phase C runs on its own cadence, not on the World-Class launch cadence.

---

## Phase A / B / C · the migration programme itself

**Phase A · Make current NEX safe** (in progress · Waves 1-4)
Keep Supabase authoritative for Brain + legacy · make NEX Postgres *ready* for the future Brain. World-Class Headquarters launch lives here.

**Phase B · Flip the Brain** (Wave 5 · gated on Wave 1 + Wave 2 completion)

```
NEX_BRAIN_BACKEND=supabase
        ↓
   Migration 046 applied to prod NEX Postgres
        ↓
NEX_BRAIN_BACKEND=postgres  (Vercel env flip · A2)
        ↓
   Verify everything · reverse-shadow observation window
```

**Phase C · Gradually migrate legacy systems** (post-launch · out of World-Class scope)
Subsystem-by-subsystem Supabase → NEX Postgres cutover. Own cadence. Own authorisation per subsystem. Does not block Headquarters GA.

---

## Consequences for prior documents

- `WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md` · C-1 severity refined: **P1 gate for the Wave 5 flip**, NOT a landmine for arbitrary deploys under current `NEX_BRAIN_BACKEND=supabase`. See `NEX-STORAGE-AUTHORITY-CHECK.md` §11 for the derivation.
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md` · Wave 1 target scope: **NEX Postgres only**. Never apply 046 to Supabase (different schema · different code path · no consumer).
- Any future doc that talks about "Supabase is legacy": it isn't — it is a *required current dependency during the transition*. "Legacy" is the destination Phase C moves it toward, not the state today.

---

## The one-line reminder for any future session

> When in doubt: NEX Storage is the destination, not the current majority. Supabase is required today. Do not fold Phase C work into a World-Class wave.
