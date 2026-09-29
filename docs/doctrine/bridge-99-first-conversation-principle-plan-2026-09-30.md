# Bridge 99 · First Conversation Principle — Implementation Plan

**Status:** **SEALED v5 · §16 DOCTRINE APPROVED · Founder tick 2026-09-30**

Doctrine phase closed. Implementation authorised. Bridge 99 is NOT considered SHIPPED until the §16 operational-acceptance gate is green:
- Synthetic-abuse harness passes.
- All §13 acceptance tests actually pass in CI.
- Cookie `session_id` revocation path exercised end-to-end.
- Migrations 102 + 103 applied cleanly to `ijvqdvsvwtwxzcqmoqit`.

No further doctrine changes without founder review. Any implementation deviation from the sealed clauses is a doctrinal violation and requires a new bridge, not a silent amendment.
**v2 (2026-09-30)** added §2A (Continuity ≠ Verification), §7A (Fingerprint privacy hardening), §7B (Provisional identity lifecycle).
**v3 (2026-09-30)** removed fingerprint from identity-recovery precedence; deleted the partial unique index that would have enforced silent-merge; rewrote §7B create paragraph to distinguish atomic DB transaction from post-commit external effects; added activation-boundary principle; added A3 shared-device-isolation acceptance criterion; renamed escape valve; neutralised claim wording.
**v4 (2026-09-30 · this revision)** addressed founder KEEP/CHANGE/BLOCK review:
- **BLOCK 1 resolved** — §13 A2 fingerprint test rewritten with the founder's three-step cookie-vs-fingerprint sequence.
- **BLOCK 2 resolved** — §13 RLS criterion rewritten to explicitly enumerate three access classes (provisional sender / conversation owner / unrelated third party).
- **BLOCK 3 resolved** — data placement restructured: `provisional_fingerprint` moved off `nex_account` into a new risk-service-owned `nex_account_risk_signal` table with no authenticated RLS policies; `origin_cover_business_id` moved from `nex_account` to `nex_peer_conversation` because origin is conversation provenance, not identity attribution.
- Cookie contract in §7 expanded (Secure, Max-Age, Domain/Path scope, subdomain trust boundary, server-side revocation, signing-key rotation).
- Cover-visit-vs-abandonment loophole closed: cover visits do NOT update `last_activity_at`.
- A3 wording tightened to distinguish fingerprint-inheritance (prohibited) from cookie-inheritance (outside identity resolution).
- Q1 telemetry-anti-profile clause added; Q3 operational validation committed; Q7 silent-first challenge accepted as preferred UX.
- §13 crypto test scope extended to logs + error payloads + telemetry, not just DB.
- "Subpoena-safe" language removed; replaced with factual crypto statement per founder direction.

**v5 (2026-09-30 · this revision)** applied the three final CHANGE items from founder v4 review; no BLOCKs remaining:
- **Abandonment formula corrected** — owner-side reads/replies/starring/archiving MUST NOT reset the visitor's abandonment timer. Formula reduced to `GREATEST(created_at, MAX(sent_message_at), MAX(claim_interaction_at))`. Visitor lifecycle is independent of owner activity.
- **Session cookie made genuinely revocable** — signed payload now includes a per-instance `session_id` (jti); server-side revocation operates on `session_id` not on the account; signature validity alone is insufficient after revocation. Explicit validity check: `signature_matches AND now < expires_at AND session_id NOT IN revoked_sessions`.
- **A2 Step 3 tightened** — split into Step 3a (no valid session · fingerprint X → new account, MUST NOT be A) and Step 3b (valid session for account B · fingerprint X → resolves to B, MUST NOT be A or C). Eliminates the "cookie B" ambiguity.
**Do not write code from this document until the founder has signed off on §16.**
**Founder-sealed doctrine:** 2026-09-30 (this doc extends the sealed principle into a plan).

---

## 1 · Founder-locked decisions

These are not up for reconsideration during implementation.

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | `nex_account.claimed_at timestamptz NULL` — NULL = provisional, timestamp = claim moment. **No boolean** `provisional`. | Single source of truth. No contradictory flag/timestamp pair. Trivially indexable, temporally expressive. |
| L2 | Private key on device (IndexedDB), server holds only public key + account row + claim credential metadata + encrypted relay data. **Never plaintext message content.** | Reconciles with phone-is-database doctrine (2026-09-29). Reuses Bridge 74 `nex_account_device_key` unchanged. |
| L3 | Risk scoring is a **deterministic service boundary**, not embedded in the composer. Global defaults ship first; owner-level configuration is a follow-up. | Anti-abuse rules must evolve without rewriting Cover/Chat surfaces. |
| L4 | Claim happens inside existing `/nex-native/settings/profile`. **No dedicated `/claim` route** unless testing proves it needs one. | Keeps the first-message flow almost invisible. Adding a claim product journey defeats the purpose. |

## 2 · Founder-locked acceptance criteria

| # | Requirement | Test artefact |
|---|-------------|---------------|
| A1 | The same person visiting **20 different NEX covers** remains a **single** NEX user via the signed `nex_session` cookie, not 20 provisional identities. | Playwright scenario: same authenticated session sends first message to 20 seeded businesses → assert single `nex_account.id`. Fingerprint alone is NOT a valid path to satisfying this test. |
| A2 | **Idempotency** — double-tapping Send, network retries, page refreshes, and reopening a Cover must NOT create duplicate accounts OR duplicate first-message conversations. | Fault-injected integration test with forced retries and race conditions. |
| A3 | **Two-person shared-device isolation (v3 · founder-tightened).** Two different people must NEVER silently inherit a provisional NEX account solely because fingerprint or network signals match. A valid `nex_session` represents an existing account-bearing browser session; changing the human using that session is outside identity resolution until the user explicitly chooses "Start fresh on Covers" or otherwise establishes a different account. | Playwright: Person A messages Maria from a cover → provisional A created. Fresh incognito window on same machine (no cookie, deliberately colliding fingerprint), Person B messages Maria → MUST create provisional B. The test proves that fingerprint alone does NOT resolve identity — it does NOT test the browser-session-sharing scenario, which is outside the identity-resolver boundary per §7 Cookie contract. |

## 2A · Locked principle · Account continuity ≠ identity verification

Founder-sealed 2026-09-30. Adopted after review of the first draft of this plan. This principle is orthogonal to L1–L4 and gates every downstream decision.

**Continuity** is a session property: does NEX recognise this actor as the same NEX account across 20 covers, across a refresh, across a device migration after claim?

**Verification** is an attribute property: is this account face-verified (Personal ✓ tick per Bridge 41), phone-verified, Supabase-authenticated, or Business-verified (`nex_business.verified_at` per Bridge 30)?

These properties are independent. A provisional account has continuity (§7) but **zero verification**. A claimed account gains display attributes and personhood cues but still needs the Bridge 41 signals to earn the Personal ✓ tick. A Bisnis account layers on business verification.

**Consequences that MUST hold in all downstream code:**

- Never treat "same `nex_account.id` returned by the continuity resolver" as evidence of authenticity, trustworthiness, or personhood. It is not.
- The owner inbox chip `NEW VISITOR · not yet verified` is not decorative — it is the primary UI communication of this distinction and must render whenever `claimed_at IS NULL`.
- Trust-gated affordances (offering to place an order above a threshold, sharing an escrow link, unlocking Bisnis-only actions, sending an attachment before claim) MUST gate on `claimed_at IS NOT NULL AND <appropriate verification signal>` — never on session continuity alone.
- Any log line, telemetry event, or audit record that references `nex_account.id` MUST also carry the `claimed_at` state so downstream investigators cannot conflate the two.

**Doctrine sentence:**
> Continuity answers "is this the same NEX account I saw before?" Verification answers "is this actor who they claim to be?" A provisional identity provides continuity and nothing else.

## 3 · Scope statement

Bridge 99 delivers:

- Every one of the 10 sealed cover layouts renders the NEX composer as its footer.
- Sending a first message from a cover creates a **provisional NEX identity** (if none exists) with the same schema, same E2E keypair architecture, and same NEX1 auto-welcome as any account.
- After send, the visitor lands in the owner's peer-chat thread using their new (or existing) NEX identity, with the outbound message already delivered end-to-end encrypted.
- A single visitor is a **single** NEX identity across every cover they message, on every device they use, as long as identity signals reconcile.
- Owners see provisional senders labelled clearly and see the label upgrade when the visitor claims.

Bridge 99 does **not** deliver:

- A `/claim` page (L4).
- Owner-level risk-scoring configuration UI (L3 · follow-up).
- Provisional-to-provisional peer relationships (only visitor → owner from a cover in v1).
- Cross-device key migration for claimed accounts (tracked separately as B99+claim-migrate).

## 4 · State machine

```
                       VISITOR OPENS COVER
                                │
                                ▼
                     Existing NEX session on device?
                        │                     │
                       YES                   NO
                        │                     │
                        │            Generate device keypair
                        │            (nacl.box, Bridge 74 path)
                        │                     │
                        │            Reconcile identity across
                        │            device signals (see §7)
                        │                     │
                        │            Idempotent upsert:
                        │            provisional nex_account row
                        │            + device_key row
                        │                     │
                        └──────────┬──────────┘
                                   ▼
                          Encrypt message with
                          owner's public key(s)
                          (Bridge 76 path unchanged)
                                   │
                                   ▼
                          Submit to risk service
                          (deterministic scoring)
                          │              │           │
                        pass         challenge     block
                          │              │           │
                          │        Lightweight       │
                          │        verification      │
                          │        (turnstile /      │
                          │         phone / face)    │
                          │              │           │
                          └──────┬───────┘           │
                                 │                   │
                                 ▼                   ▼
                     Persist to nex_peer_message   Reject
                     (encrypted body), get-or-     with
                     create nex_peer_conversation  actionable
                                 │                 error
                                 ▼
                     Fire NEX1 auto-welcome
                     (Bridge 62 hook · once
                      per newly-created account)
                                 │
                                 ▼
                     Redirect to /nex-native/chat/peer/{ownerId}
                                 │
                                 ▼
                     "Finish your NEX" opportunity
                     (banner or bottom sheet · dismissible)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
              /settings/profile          Skip for now
              claim flow                 (account persists
                    │                     provisionally)
                    ▼
              claimed_at populated
              display_name/avatar/etc set
              Personal ✓ tick logic (Bridge 41) begins
```

## 5 · Data model — migration 102

```sql
-- Migration 102 · Provisional account state · Bridge 99 · v3 founder-corrected
-- ---------------------------------------------------------------------------
-- Adds the founder-sealed "First Conversation Principle" state model to
-- nex_account and separates risk signals + origin attribution into their
-- correctly-owned locations:
--
--   nex_account.claimed_at              -- identity lifecycle (this doctrine)
--   nex_peer_conversation.origin_cover  -- conversation provenance (§7B v3)
--   nex_account_risk_signal (new)       -- risk-service-owned storage (§7A)
--   nex_peer_message.send_intent_id     -- idempotent send key (§7)
--
-- v1 had provisional_fingerprint and origin on nex_account. Founder review
-- (v3) rejected both placements: fingerprint on nex_account creates a
-- future-regression trap where later code may accidentally use it for
-- identity lookup; origin on nex_account permanently binds a person to the
-- first business they messaged, which is a conversation property not an
-- identity one. Both moved.

BEGIN;

-- ---------------------------------------------------------------------------
-- Part A · nex_account · identity-lifecycle column only
-- ---------------------------------------------------------------------------

ALTER TABLE nex_account
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_nex_account_unclaimed
  ON nex_account (created_at DESC)
  WHERE claimed_at IS NULL;

COMMENT ON COLUMN nex_account.claimed_at IS
  'Bridge 99 · Founder-sealed 2026-09-30. NULL = provisional identity created by a first message from a NEX Cover · timestamp = user claimed via /settings/profile. Same schema, same FKs downstream · provisional vs claimed is a lifecycle state.';

-- ---------------------------------------------------------------------------
-- Part B · nex_peer_conversation · origin is conversation provenance
-- ---------------------------------------------------------------------------
-- Moved from nex_account per founder v3 review: a person can converse with
-- many businesses over time; their identity should NOT be permanently marked
-- by the first business they ever messaged. Origin belongs to the
-- conversation, not the person.

ALTER TABLE nex_peer_conversation
  ADD COLUMN IF NOT EXISTS origin_cover_business_id uuid NULL
    REFERENCES nex_business(id) ON DELETE SET NULL;

COMMENT ON COLUMN nex_peer_conversation.origin_cover_business_id IS
  'Bridge 99 · Founder-sealed 2026-09-30. The cover a conversation was born from (set on cover-originated creates · never mutated · NULL for conversations that did not originate on a cover). Conversation-scoped provenance, not identity attribution. See §5 v3 rationale.';

-- ---------------------------------------------------------------------------
-- Part C · nex_peer_message · idempotent send key
-- ---------------------------------------------------------------------------
-- Client-generated UUID accompanying every first-message POST. Server-side
-- unique constraint makes double-tap Send, network retries and refresh
-- races idempotent at the database level, not just at the UI level (see §7).

ALTER TABLE nex_peer_message
  ADD COLUMN IF NOT EXISTS send_intent_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_peer_message_send_intent
  ON nex_peer_message (sender_id, send_intent_id)
  WHERE send_intent_id IS NOT NULL;

COMMENT ON COLUMN nex_peer_message.send_intent_id IS
  'Bridge 99. Client-generated UUID · unique per intent-to-send · enables server-side idempotent upsert for double-tap, retry, refresh races. Nullable for historical rows that predate Bridge 99.';

-- ---------------------------------------------------------------------------
-- Part D · nex_account_risk_signal · risk-service-owned storage
-- ---------------------------------------------------------------------------
-- Fingerprint and future risk signals live here, NOT on nex_account. This is
-- an explicit doctrinal separation: risk data must not become identity
-- infrastructure. The table exists only to be read/written by the risk
-- service in §8. No RLS policies for authenticated role → no authenticated
-- read access at all (Supabase pattern: service-role bypasses RLS). Any
-- future code that JOINs this table for account lookup, resolution,
-- authentication, or recovery is a doctrinal violation.

CREATE TABLE IF NOT EXISTS nex_account_risk_signal (
  account_id                    uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE,
  provisional_fingerprint       text NULL,
  fingerprint_last_computed_at  timestamptz NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nex_account_risk_signal_fp
  ON nex_account_risk_signal (provisional_fingerprint, created_at)
  WHERE provisional_fingerprint IS NOT NULL;

ALTER TABLE nex_account_risk_signal ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies granted to authenticated role. Only service-role
-- (used exclusively by the risk service) may read/write.

COMMENT ON TABLE nex_account_risk_signal IS
  'Bridge 99 · Founder-sealed 2026-09-30. Risk-signal storage OWNED BY THE RISK SERVICE. MUST NOT be joined against for identity resolution, account lookup, authentication, or recovery. Separated from nex_account to prevent the structural regression trap identified in v3 founder review (§5, §7A). Access restricted to service-role via absence of authenticated RLS policies.';

COMMENT ON COLUMN nex_account_risk_signal.provisional_fingerprint IS
  'Bridge 99. Salted hash of narrow, whitelisted device signals (see §7A). Contributes to abuse/velocity scoring only. NEVER a resolver input · silent cross-actor merging is prohibited (§7A false-positives). No unique constraint deliberately.';

COMMIT;
```

**Doctrinal reasons for the v3 restructure:**

1. **Why `provisional_fingerprint` moved off `nex_account` into its own risk-owned table:** placing the fingerprint on the identity anchor invites future contributors to `SELECT * FROM nex_account WHERE provisional_fingerprint = ?` for account lookup — exactly the regression this doctrine prohibits (§7A false positives). Moving it to a table with no authenticated RLS policies makes the database itself reinforce the separation.

2. **Why `origin_cover_business_id` moved from `nex_account` to `nex_peer_conversation`:** origin is conversation provenance, not a permanent identity attribute. A visitor who first messages Maria, then messages Hammerex, then messages a creator, should NOT carry "born on Maria's cover" as an identity marker forever. Each conversation carries its own origin. Growth funnel attribution can still be built by aggregating conversations by origin — a JOIN, not a permanent flag.

3. **Why NO unique constraint on `provisional_fingerprint`:** enforcing uniqueness would silently attach a second visitor sharing the same NAT/browser/timezone to the first visitor's account and history — a privacy hazard prohibited by §7A. The fingerprint contributes to abuse/risk scoring; it never resolves identity.

**Downstream code implications:**
- `provisional-account-service.ts` MUST NOT import or query `nex_account_risk_signal`.
- `risk-service.ts` is the only module authorised to read/write `nex_account_risk_signal`.
- Growth analytics queries that aggregate by cover origin JOIN `nex_peer_conversation` on `origin_cover_business_id`, not `nex_account`.
- Any PR touching either boundary requires founder review.

## 6 · Component wiring

New files (12):

```
src/lib/nex-native/first-conversation/
  provisional-account-service.ts        # get-or-create provisional account · MUST NOT read nex_account_risk_signal
  provisional-fingerprint.ts            # server-side fingerprint compute (pure) · consumed only by risk-service
  risk-service.ts                       # deterministic risk scoring boundary · SOLE writer/reader of nex_account_risk_signal
  risk-signals.ts                       # signal extractor (headers, session, velocity)
  first-message-orchestrator.ts         # ties account + risk + conversation + message + outbox

src/app/api/nex-native/first-message/
  route.ts                              # POST /api/nex-native/first-message

src/app/nex-native/cover/_composer/
  CoverComposer.tsx                     # composer primitive (mirrors PeerComposer skin)
  useCoverSendMessage.ts                # client hook · handshake + submit + redirect
  ClaimBanner.tsx                       # post-redirect "Finish your NEX" affordance

src/app/api/nex-native/session/
  reset-cover-continuity/route.ts       # POST · server-side cookie revocation + risk-signal rotation

src/lib/nex-native/welcome-outbox/
  welcome-outbox-service.ts             # enqueue + claim event · idempotent
  welcome-outbox-worker.ts              # at-least-once delivery worker

nex-supabase/migrations/
  102_bridge99_provisional_state.sql    # per §5 v3: nex_account.claimed_at + conversation origin + send_intent_id + nex_account_risk_signal table
  103_nex_welcome_outbox.sql            # per Q8 v3: outbox scoped to provisional-create only

scripts/
  verify-bridge99-idempotency.mts       # A2 + A3 acceptance test harness
  bridge99-synthetic-abuse-harness.mts  # Q3 operational validation before rollout

docs/doctrine/
  bridge-99-first-conversation-principle-plan-2026-09-30.md   # this file
```

Modified files (5):

```
src/app/nex-native/cover/layouts.tsx      # each layout renders <CoverComposer/> as footer
src/app/nex-native/cover/theme-skin.tsx   # exposes composer-safe bottom-inset slot
src/lib/nex-native/chat-theme-service.ts  # (already loaded) — no schema change, verify accent flow
src/lib/nex-native/peer-message-service.ts# accept provisional sender in RLS-checked path
src/app/nex-native/chat/peer/[accountId]/page.tsx  # render "NEW VISITOR" chip when peer.claimed_at IS NULL
```

## 7 · Idempotency & 20-cover single-identity strategy

**Identity resolver precedence** (first match wins; upsert on the same `nex_account.id`). Amended v3 · fingerprint removed from this chain per §7A:

1. **Authenticated Supabase session** → existing `nex_account.supabase_user_id`. Highest trust. Skip provisional path entirely.
2. **Signed NEX session cookie** (`nex_session` — new for B99) referencing an existing `nex_account.id`. Set atomically on provisional create (post-commit, see §7B). See "Cookie contract" below for security requirements.
3. **No match → create a new provisional account.**

That is the entire identity resolver. Fingerprint does not appear.

**Cookie contract (v4 · founder-required).** The `nex_session` cookie is a security credential and MUST be treated as one. Minimum attributes:
- `Secure` (HTTPS only · required in all environments except localhost dev).
- `HttpOnly` (no JS access).
- `SameSite=Lax` (allows top-level navigation, blocks cross-site requests).
- **Unique session identifier (session_id / jti · v4 founder-required).** The signed payload MUST include a unique per-credential-instance session identifier in addition to account identity and temporal claims. Signed payload structure: `{ account_id, session_id, issued_at, expires_at }`, with HMAC over the full payload using a rotating server-side signing key. Signature validity alone MUST NOT be sufficient after revocation; the server MUST verify the `session_id` is not revoked before accepting the credential. Without a per-instance identifier the cookie is a pure bearer token replayable until natural expiry, which is unacceptable.
- `Max-Age` — defined explicitly; not a session cookie. Recommended default 30 days rolling, capped at 90 days absolute (see abandonment interaction below).
- `Domain` and `Path` scope MUST be explicitly defined by the NEX session architecture. Any shared-subdomain scope (e.g. `.nex.com` covering `mariascafe.nex.com`) MUST be treated as a security trust boundary and reviewed on that basis — a `.nex.com` cookie is readable by every NEX subdomain by design.
- **Server-side revocation** MUST exist and MUST operate on `session_id`, not on the account. `/settings/reset-cover-continuity` (v3 escape valve) invalidates the specific `session_id` presented, server-side, not just client-side. A revoked `session_id` cannot be reused even if the client presents a still-signature-valid cookie. Revocation state persists in a server-side session registry (name deliberately unspecified — `nex_session_registry` / `nex_account_session` / equivalent — the doctrinal requirement is that a revocation record exists, not the table name).
- **Signing-key rotation** — a documented procedure exists to rotate the HMAC signing key. Rotation invalidates all outstanding tokens except during an overlap window (recommended 7 days) during which both keys are accepted. Rotation cadence: at minimum once per year, or immediately on suspected key compromise.

**Validity check (v4):** an incoming cookie is valid iff `signature_matches AND now < expires_at AND session_id NOT IN revoked_sessions`. All three conditions MUST hold; failure of any one causes the resolver to treat the request as having no valid session credential and fall through to precedence 3 (create new provisional).

**Cover visits do NOT reset the abandonment timer (v3 · founder-required).** The `nex_session` cookie may be re-presented on every Cover visit as identification, but a Cover visit is NOT "account activity" for the purposes of §7B idle expiry. Only defined account activity — an authenticated message send, a claim action, an explicit `Complete your profile` interaction — may update `last_activity_at`. Merely opening a Cover with a valid cookie MUST NOT keep an otherwise-abandoned provisional alive. Without this rule, a passive browser could keep an unused account alive indefinitely.

**Cookie sharing is a residual risk, not an identity resolver failure.** If two humans share the same browser and cookie, the system treats them as the same NEX account. This is the same trust model as every other web application; it is outside identity resolution and requires cookie hygiene (per-user browser profiles, incognito, or explicit "Start fresh on Covers"). See §7B A3 discussion.

**Fingerprint's role (separate, non-identity):**

Fingerprint enters `risk-service.ts` (§8) as a signal contributing to abuse/duplicate-send/velocity scoring. It never enters `provisional-account-service.ts`. See §7A: "The resolver MUST prefer creation of a new provisional account over silently attaching a potentially different actor to an existing provisional account."

**Guarantees delivered by this precedence chain:**

- **20-cover single-identity (A1):** cover #1 sets the `nex_session` cookie post-commit. Covers #2–20 read the cookie → precedence 2 wins → same `nex_account.id` every time. If the cookie is cleared between covers, a fresh provisional is created — this is by design (A3). The founder-sealed guarantee is "cookie-scoped continuity," not "device-scoped continuity."
- **Double-tap Send:** client hook `useCoverSendMessage` uses a `sendState` machine (idle → sending → sent). Buttons disabled while sending. Server-side, the first-message endpoint requires a client-generated `send_intent_id` (UUID v4 in the request body); the endpoint upserts `nex_peer_message` on `(sender_id, send_intent_id)` — double-post is a no-op returning the original row. `UNIQUE (sender_id, send_intent_id)` added to `nex_peer_message` in migration 102.
- **Network retry:** same `send_intent_id` reused → same no-op upsert.
- **Refresh mid-flow:** if refresh happens before send completes, no server persistence → user retypes. If refresh happens after send but before redirect, the cookie is set → next cover load hits precedence 2 and drops them straight into the owner's chat.
- **Reopen the cover:** existing NEX session detected at precedence 1 or 2 → composer renders "You're already talking to Maria →" affordance rather than opening a fresh conversation. `get_or_create_peer_conversation()` normalises the pair (Bridge 3 sealed behaviour).

**Deferred edge cases (documented, not blocking):**
- User creates a provisional on Device A, visits the same cover on Device B pre-claim → B has no cookie → precedence 3 creates a new provisional. Owner sees two visitors. This is now doctrinally correct (§2A / §7A / A3), not a v1 limitation. Consolidation only at claim, and only user-initiated (§7B merge policy).
- User clears cookies between covers → treated as a new visitor. Fingerprint might match but does NOT restore identity (§7A).

## 7A · Fingerprint mechanism · privacy-hardened bounds

`provisional_fingerprint` is **idempotency and abuse infrastructure**, not identity infrastructure. Every constraint below is load-bearing. Any code path or migration that violates these constraints requires founder review, not maintainer approval.

**Signals in scope (composing the hash):**
- Client-generated stable `device_id` from IndexedDB (already used by Bridge 74 · we do not create a second parallel identifier).
- Coarse user-agent class (browser family only, e.g. `chromium` / `webkit` / `gecko` — never the full UA string).
- IP address bucketed to `/24` (never the full IP).
- Timezone offset in minutes only (never the IANA zone name — that is far more identifying).
- Accept-language primary tag (`en`, `id`) — no region, no quality values, no reorderable secondary list.

**Signals explicitly out of scope · MUST NEVER be added:**
- Canvas, WebGL, or AudioContext fingerprinting.
- Screen resolution, viewport dimensions, pixel ratio, colour depth, or orientation.
- Font enumeration.
- Battery status, hardware concurrency, memory, GPU descriptors, deviceMemory.
- Full IP address (only `/24` bucket permitted).
- Full user-agent string.
- Precise geolocation, IP-geo city/country, or any location signal beyond timezone offset.
- Media device enumeration, Bluetooth availability, or sensor APIs.
- Any signal that is passively harvestable without user cooperation and that meaningfully narrows identity.

The pure function `computeProvisionalFingerprint()` is the sole authority. It ships with an inline whitelist of its own inputs; adding an argument to the function requires founder sign-off and a doctrine amendment. Reviewers should treat any PR that broadens the signal set as blocked-by-default.

**Salt and rotation (v3 · founder-corrected):**
- Server-side salt, rotated every 30 days with a 7-day overlap so freshly-rotated fingerprints don't invalidate active in-flight risk evaluations.
- The application-level fingerprint function receives only the minimum derived values required for its approved signal set. Full IP addresses, when necessarily available at the network/edge layer, MUST NOT be persisted or passed into downstream identity infrastructure; only the approved coarse `/24`-derived signal may enter risk evaluation.
- Salt rotation deliberately weakens long-range fingerprint linkability. Rotation has no effect on session continuity, which flows through the `nex_session` cookie only (§7).

**Storage lifetime:**
- Written on provisional create (§7B).
- Cleared to `NULL` on claim.
- Deleted with the account row on purge (§7B abandoned-account cleanup).
- Never copied, joined, exported, or referenced by any downstream table other than `nex_account`.
- No unique constraint (v3 correction). A previous draft included a partial unique index; that would have enforced silent cross-actor merging, which is prohibited. See §5.

**False positives (v3 · founder-corrected):**
- Bounded signal collisions are possible (shared NAT, same browser class, same timezone).
- **A fingerprint match MUST NOT by itself establish account continuity when the session credential is absent.** If the NEX session cookie is unavailable, the resolver MUST prefer creation of a new provisional account over silently attaching a potentially different actor to an existing provisional account.
- Fingerprint matching may contribute to abuse/idempotency risk scoring but MUST NOT be sufficient to recover a provisional identity.
- This is the load-bearing correction of v3. The v1 draft explicitly proposed the prohibited behaviour; the v3 doctrine explicitly forbids it.

**False negatives — expected and doctrinally correct:**
- Same visitor on a VPN, in a private-browsing window, or on a new device gets a fresh provisional identity. This is privacy-preserving separation of contexts and is intended.

**Never treated as proof:**
- A fingerprint match returns a SUGGESTION to the continuity resolver. It never authorises a privileged action. It does not appear in any trust affordance. It does not gate content access. Its only outputs are `same-provisional-account-id` or `no-match`.
- See §2A · the resolver produces continuity, never verification.

**Auditability:**
- `computeProvisionalFingerprint()` and `assessRisk()` are pure functions with published test vectors in `scripts/verify-bridge99-idempotency.mts`.
- Any external observer can run the vectors and confirm the input surface has not been broadened.
- Any signal not in the whitelist is a doctrinal violation regardless of test coverage.

**User escape valves:**
- `/settings/reset-cover-continuity` (internal route · user-facing label: "Start fresh on Covers") action available to any account (provisional or claimed). Wipes the `nex_session` cookie AND rotates the account's fingerprint to a fresh value. Next cover visit treats the user as a new visitor.
- Claim severs the fingerprint tie irrevocably (`provisional_fingerprint` set to NULL, unique index released).
- Purge deletes the fingerprint along with the row.

**Legal / Terms framing:**
- Fingerprint is documented in the Privacy section of `/nex-native/about/terms` as "narrow idempotency infrastructure for anti-abuse — not identity, not cross-site tracking, not analytics."
- Communicated in NEX's proactive-privacy tone per the sealed privacy-copy doctrine (2026-09-29): as ownership language, not a consent modal.

**Doctrine sentence:**
> The fingerprint answers "is this the same visitor for idempotency purposes right now?" It never answers "who is this?"

## 7B · Provisional identity lifecycle

Every state transition below is authoritative for v1. Deviations require founder sign-off.

**Activation boundary (v3 · founder-sealed).** A provisional NEX account is born on the visitor's first successful message send from a Cover, NOT on Cover open. Merely opening a Cover MUST NOT provision an account, MUST NOT set the `nex_session` cookie, and MUST NOT insert any row into `nex_account`. The account exists because the visitor chose to enter the conversation. Curiosity does not create identity; participation does.

**Create (v3 · founder-corrected).** The database mutation is atomic:
1. Insert `nex_account` row (`display_name = 'New visitor'`, `claimed_at = NULL`). No fingerprint, no origin on this row per §5 v3.
2. Insert `nex_account_device_key` row (Bridge 74 pattern) with the browser-generated `device_id` + freshly-created public key.
3. `get-or-create` `nex_peer_conversation` — for a cover-originated create, ALSO set `origin_cover_business_id = $ownerBiz` on the conversation row (§5 Part B). Bridge 3 canonical pair normalisation is unchanged.
4. Insert `nex_peer_message` with `send_intent_id = $clientIntentId` (encrypted ciphertext, Bridge 76 path). Server-side unique constraint on `(sender_id, send_intent_id)` (§5 Part C) makes repeated posts idempotent.
5. Insert `nex_account_risk_signal` row keyed on the new `account_id`, with `provisional_fingerprint = $fp`. This row is written by the risk service, not by the provisional-account service (§5 Part D). The account service and the risk service both participate in the same transaction; neither may read from the other's table for identity purposes.
6. Insert a durable `nex_welcome_outbox` event referencing the new `account_id` (NEX1 welcome, Bridge 62 hook, migration 103).

Any database failure rolls back the database transaction — no half-born accounts, no orphaned device keys, no ghost conversations.

**External effects, including session-cookie issuance and NEX1 welcome delivery, occur only after successful transaction commit and MUST be idempotent.** No externally visible effect may be treated as committed before the database transaction commits.

Post-commit order:
7. Application sets the `nex_session` cookie per the security spec in §7 Cookie contract. Cookie issuance failure at this stage is logged but does not invalidate the account — a returning visitor without the cookie is a new visitor per §7.
8. Welcome-outbox worker (separate process, at-least-once delivery) claims the outbox event and sends the NEX1 welcome message. Idempotency key: `(outbox_event_id)` — replayed events are no-ops.
9. Redirect payload returned to client.

**Active provisional (`claimed_at IS NULL`).** Capabilities:
- CAN receive messages from owners it has already contacted.
- CAN send further messages within existing conversations.
- CAN receive the NEX1 welcome and reply to NEX1.
- CANNOT initiate conversations with arbitrary NEX accounts — only owners it has messaged from a cover. This prevents the composer from being weaponised as a general-purpose outbound spam vector.
- CANNOT appear in Directory (§10 cross-doctrine · Personal profiles never Directory-listed regardless of claim; provisional additionally prohibited).
- CANNOT upload attachments in v1 (Q6 in §15). Text-only.
- CANNOT set display_name, avatar, bio, or theme anywhere except through the claim flow at `/settings/profile`.
- CANNOT unlock Bisnis features (there is no purchase path from an unclaimed account by design).

**Idle detection (v4 · founder-corrected).** `last_activity_at = GREATEST(created_at, MAX(sent_message_at), MAX(claim_interaction_at))`.

- **Cover visits and cookie re-presentation do NOT count as activity** — see §7 Cookie contract.
- **Owner-side activity does NOT count as visitor activity.** Owner reads, owner replies, owner starring, owner archiving, and any other owner-driven action MUST NOT reset the provisional account's abandonment timer. The visitor's account has an independent lifecycle. If the owner keeps opening a conversation for months while the visitor never returns, the visitor's provisional still purges at 90 days. The message record's residency remains governed by the message-retention policy (Bridges 77–78), which is separate.
- Only the visitor themselves — sending a message, interacting with the claim flow — refreshes their own timer.
- This prevents both a passive open browser and an attentive owner from keeping an abandoned provisional alive past the 90-day purge.

**Idle expiry — soft (60 days).** A daily cron populates `nex_account_provisional_expiring` (view or materialised list). If the visitor returns to any cover within this window, activity refreshes and the count resets. No warning email — there is no email attached, doctrinally. This window exists solely to give a returning visitor a runway before hard purge.

**Purge — hard (90 days).** After 90 days of no activity, an idempotent cron deletes the account row. Cascade removes `nex_account_device_key` rows and all `nex_peer_message` rows where the account is sender or recipient. Owner's inbox thread renders any residual references as `Deleted visitor · account expired`.
- Deletion is irreversible. No soft-delete, no archival tombstone beyond an anonymised counter for growth analytics.
- Aligned with Bridges 77–78 delivered-purge posture and phone-is-database doctrine — server retains nothing it does not need.

**Claim (atomic) — v3 wording.** In `/settings/profile`, the user attaches at least one durable credential. Claim may use a Bridge 40 face-verification credential, phone OTP, or explicit Supabase sign-in. These credentials establish the corresponding verification/claim state defined by their respective bridges; none should be inferred from provisional continuity alone (see §2A). The choice of credential does not privilege one path above the others at the claim boundary — Bridge 41 remains the sole authority on the Personal ✓ tick once claim has committed.

Claim transaction:
1. `nex_account.claimed_at = now()`.
2. `nex_account.provisional_fingerprint = NULL`.
3. `nex_account.display_name`, `avatar_url`, `daily_activity` populated from claim form input.
4. Optionally link `supabase_user_id` when Supabase path is chosen.
5. Fire the Personal ✓ tick evaluator (Bridge 41 logic) — evaluator consumes claim inputs and any pre-existing signals to decide tick eligibility.
6. Broadcast identity update to any active peer conversations so owner inbox chips flip live.

**Conversation continuity across claim.** No conversations are severed. Owners see the same thread. The sender's identity chip flips from `NEW VISITOR · not yet verified` to the claimed identity plus any earned ticks. Historical bubbles retro-render with the new display name and avatar — no ciphertext rewrite (display data is joined at render time).

**Device / browser changes before claim.** Direct consequence of the phone-is-database doctrine and the v3 correction that fingerprint no longer resolves identity:
- Device A holds the private key in IndexedDB and the `nex_session` cookie in cookie storage. Device B has neither.
- A visitor who messages Maria from their phone (Device A), then opens Maria's cover on their laptop (Device B) without claiming, appears to Maria as **two separate visitors**. This is doctrinally correct per §2A / §7A / A3, not a v1 limitation.
- Post-claim, either device can sign in via the claim credential and access the claimed account. Cross-device key transfer for claimed accounts is tracked as `B99+claim-migrate` (out of scope for v1).

**Multi-device / multi-session scenarios (authoritative table, v3-corrected):**

| Scenario | Outcome |
|----------|---------|
| Device A messages Maria; Device B (same visitor, no claim) opens Maria's cover | B has no cookie → precedence 3 → B creates a NEW provisional. Maria sees two visitors. Merge only at claim, only user-initiated (see below). |
| Device A messages Maria; Device A claims later | Single account, claimed. Conversation history intact. Personal ✓ evaluator runs. |
| Device A messages Maria; Device B messages Maria; visitor claims on Device C | Whichever provisional the claim credential attaches to first gets `claimed_at`. Other provisional persists until 90-day purge. **No auto-merge in v1.** |
| Device A messages Maria; visitor wipes IndexedDB (or cookies) on Device A; reopens Maria's cover on Device A | No cookie → precedence 3 → NEW provisional. Old provisional persists server-side but the visitor cannot access it (private key gone with IndexedDB). Fingerprint match does NOT resurrect the old identity — see §7A. Old account eventually purges at 90 days. |
| Device A visitor loses phone before claim | Identity lost. Doctrinally aligned with phone-is-database. Provisional account eventually purges via 90-day idle. Documented in Terms. |
| Device A messages Maria; visitor claims via face-verify on Device A; later signs in on Device B via claim credential | Device B generates a new keypair (Bridge 74 pattern), joins existing conversations via fan-out-per-device encryption. Owner-to-account ciphertext already exists per device, so no history rewrite required. |
| Person A messages Maria on shared machine; Person B (different human, same device / browser / NAT) later messages Maria in a fresh session | Cookie may or may not persist depending on browser sharing model. If cookie persists → precedence 2 wrongly identifies B as A. **The application MUST NOT rely on this scenario being handled by fingerprint separation.** Cookie hygiene (session prompts, incognito, per-user profiles) is the user's responsibility. Bridge 99 v1 accepts this residual risk as the reasonable trade-off of cookie-based continuity; a future bridge may layer WebAuthn or per-tab session isolation. |

**Recovery mechanics after claim.**
- Claimed accounts have a recovery path via the claim credential (face / phone / Supabase auth). Losing all devices means recovery via credential re-verification; history encrypted with lost devices' private keys is unreadable. Device-held encryption minimizes server-side plaintext exposure; it does not constitute a guarantee of legal or subpoena immunity, and no NEX-facing copy should imply otherwise.
- Cross-device claimed-account key transfer for improved recovery UX is deferred to `B99+claim-migrate`.

**Abandoned accounts.**
- Any provisional hitting the 90-day threshold is deleted along with its device keys. No soft-delete, no archival tombstone for the account itself.
- Owner inbox threads persist as `Deleted visitor` for historical reference. Owner cannot reply (no active recipient), cannot re-message.

**Account deletion ≠ message deletion (v3 · founder-clarified).** Two lifecycles run in parallel:
- **Account lifecycle** (this doctrine): provisional row + device keys deleted at 90-day threshold.
- **Message lifecycle** (existing Bridges 77–78 delivered-purge policy): message ciphertext is purged per its own retention rules, independent of the account row's state. Owner-side conversation records may persist per whatever message-retention policy NEX already has; account purge does not force additional message deletion beyond what delivered-purge would already do.

The owner's inbox thread's residency is governed by the message-retention policy, not by account deletion. Bridge 99 does NOT introduce a `retained_by_owner=true` flag, an owner-controlled retention override, or any new privacy/retention subsystem. Starring or archiving a thread has no lifecycle effect on the visitor's provisional account.

**Merge on claim — deferred, never automatic.**
- v1 does NOT merge multiple provisional identities on claim, even when the claim credential could plausibly link them.
- Any future merge feature MUST be user-initiated (a "Combine your NEX identities" prompt in `/settings/profile` that lists candidate provisional accounts by owner and message preview) and MUST require the user to acknowledge each merge individually.
- Automatic identity consolidation is a privacy hazard and is prohibited by this doctrine.

**Grace claim window after purge.** A visitor whose provisional was purged and who returns to the same cover within N hours does NOT get their old identity back. They get a fresh provisional. Purge is irreversible by design — the alternative (grace-window resurrection) would require server-side retention of exactly the data purge is meant to eliminate.

**Doctrine sentence (v3):**
> A provisional identity is an ephemeral NEX account with best-effort device/session continuity. Verification is out of scope until claim. Everything a claimed account gains — cross-device access, ticks, Directory presence, Bisnis unlocks — flows from the claim credential, not from session continuity.

## 8 · Risk service design (L3)

Boundary: `src/lib/nex-native/first-conversation/risk-service.ts`

```typescript
export interface RiskInput {
  message_length: number;
  session_state: "authenticated" | "provisional-existing" | "provisional-new";
  ip_reputation_score: number;        // 0.0-1.0 · 0 = pristine, 1 = known abuse
  new_conversations_last_hour: number;
  new_conversations_last_day: number;
  same_message_hash_repeat_count: number;
  owner_business_id: string;
  owner_bisnis_tier: "gratis" | "bisnis";
  // Extensibility hook · owner-level thresholds land here later.
  owner_overrides?: OwnerRiskOverrides;
}

export type RiskDecision =
  | { level: "pass" }
  | { level: "challenge"; challenge_kind: "turnstile" | "phone_otp" | "face" }
  | { level: "block"; reason: string };

export function assessRisk(input: RiskInput): RiskDecision { /* pure fn */ }
```

**Global defaults for v1:**

| Signal | Threshold | Action |
|--------|-----------|--------|
| `message_length < 3` | always | block ("Say a bit more so Maria can help") |
| `same_message_hash_repeat_count >= 3` | always | block (spam vector) |
| `new_conversations_last_hour > 5` when `session_state = "provisional-new"` | | challenge: turnstile |
| `new_conversations_last_hour > 15` | any session | challenge: phone_otp |
| `ip_reputation_score > 0.7` | any | challenge: turnstile |
| `ip_reputation_score > 0.95` | any | block |
| everything else | | pass |

The function is a **pure function** of its input. All signal extraction happens in `risk-signals.ts` and is unit-testable in isolation. Composer never touches the scoring — it only handles the returned `RiskDecision`.

## 9 · UX copy

**Composer footer (all covers):**

```
Message Maria…                ➤
```

Placeholder text swaps the owner's `display_name`. No "Contact" language anywhere.

**Post-send acknowledgement** (bottom sheet on `/nex-native/chat/peer/{ownerId}` first render after cover-origin transition):

```
Message sent ✓
We've created your NEX so you can continue the conversation.

[Complete your profile →]   [Skip for now]
```

Both buttons dismiss the sheet. The account exists regardless of choice. Sheet fires only when the transition sets `?born=1` in the URL (single-use flag consumed by the client on mount).

**Owner inbox bubble chip:**

- `claimed_at IS NULL` → chip renders `NEW VISITOR · not yet verified` in muted tone alongside the message.
- `claimed_at IS NOT NULL` → chip disappears; standard identity affordances take over (Personal ✓ tick logic per Bridge 41).

**Bisnis owner filter tab** (not in v1 scope, but designed here for compatibility): "Verified" / "New visitors" / "All".

## 10 · Cross-doctrine reconciliation

| Doctrine | Reconciliation |
|----------|---------------|
| ONE NEX IDENTITY (2026-09-30) | Composer inherits `chat_theme` accent/rim/bubble preset via `CoverThemeSkin` CSS vars. Zero visual context switch cover → chat. |
| Phone-is-database (2026-09-29) | Private key stays in IndexedDB. Server sees ciphertext only. Message body never plaintext on the wire. Reuses Bridge 76 `nacl.box` path. |
| Chat-native shop (2026-09-29) | Cover shop/menu slider remains untouched. Composer is a NEW footer element beneath the existing hierarchy. |
| NEX1 auto-welcome (Bridge 62) | Same hook fires on provisional create — new visitor's inbox will contain the NEX1 welcome message on arrival at the owner's chat. |
| Personal ✓ tick (Bridge 41) | `claimed_at IS NULL` implies unverified. Tick can only appear after claim + face-verify + daily_activity per sealed logic. |
| NEX never handles payments (2026-09-28) | Composer is a text field, not a checkout. No changes to payment doctrine. |
| Chat theme ownership (2026-09-27) | Owner's `chat_theme` paints the entire cover including composer rim + ripple. |
| Privacy tone (2026-09-29) | No consent modals. No "I understand" checkbox. The post-send ack is informative, not a legal handshake. Terms link stays in the acknowledgement footer only. |
| Canonical repo rule | All work lives in `D:/trades`. No changes to `C:/Users/Victus/nexapp` prototype. |

## 11 · E2E crypto reconciliation with Bridge 74/76 (detailed)

**On provisional create (server side, atomic within a Postgres tx):**

1. `INSERT INTO nex_account (display_name, provisional_fingerprint, origin_cover_business_id) VALUES ('New visitor', $fp, $ownerBiz) RETURNING id;`
2. Return `{ account_id, session_token }`.

**On provisional create (client side, before submit):**

1. Generate `nacl.box.keyPair()` in browser. Store private key in IndexedDB keyed by device_id (Bridge 74 pattern unchanged).
2. Send `{ device_id, public_key_base64 }` to `POST /api/nex-native/device-key` (existing endpoint from B74) — this upserts `nex_account_device_key` for the new provisional account.
3. Fetch owner's device public keys (existing B76 read path).
4. For each owner device: `nacl.box(plaintext, nonce, ownerPub, ourPriv)` → ciphertext row (existing B76 pattern).
5. Submit to `/api/nex-native/first-message` with `{ send_intent_id, ciphertext_rows, owner_business_id, risk_signals }`.

**Server never sees plaintext.** L2 preserved.

## 12 · Server endpoint contract

`POST /api/nex-native/first-message`

Request:
```json
{
  "send_intent_id": "uuid",
  "owner_business_id": "uuid",
  "ciphertext_rows": [
    { "recipient_device_id": "…", "nonce_b64": "…", "ciphertext_b64": "…" }
  ],
  "risk_signals": {
    "provisional_fingerprint_hash": "…",
    "ua_class": "…",
    "tz_offset_min": 480
  }
}
```

Response (200):
```json
{
  "account_id": "uuid",
  "peer_conversation_id": "uuid",
  "first_message_id": "uuid",
  "born": true,
  "redirect_to": "/nex-native/chat/peer/{ownerAccountId}?born=1"
}
```

Response (429 · challenge):
```json
{ "challenge_kind": "turnstile", "challenge_token_endpoint": "…" }
```

Response (403 · block):
```json
{ "reason": "message_too_short" }
```

The endpoint is the ONLY server surface a cover composer talks to. Idempotency key: `(send_intent_id)` unique per request → replay-safe.

## 13 · Acceptance criteria (must all pass before Bridge 99 merges)

1. **A1** — Playwright test: `bridge99-single-identity-across-covers.spec.ts` visits 20 seeded businesses' covers within one signed `nex_session` cookie, sends a first message from each, asserts single `nex_account.id` in the DB and 20 distinct `nex_peer_conversation` rows (one per owner). Test explicitly clears the fingerprint hash to prove continuity comes from the cookie, not the fingerprint.
1a. **A3** — Playwright test: `bridge99-shared-device-isolation.spec.ts` runs Person A's session (fresh cookie) sending to Maria's cover, then a completely separate fresh session (new incognito context, same simulated IP `/24` + timezone + browser class → deliberately colliding fingerprint) sending to Maria's cover as Person B. Asserts two distinct `nex_account.id` values and two distinct owner-side inbox entries. If this test ever passes with a single account, that is a doctrinal regression and must block merge.
2. **A2** — `verify-bridge99-idempotency.mts` runs 5 scenarios:
   - Double-tap Send within 100ms → 1 message, 1 account.
   - Send + immediate refresh + retype → 2 messages (both delivered), 1 account, 1 conversation.
   - Send + forced 5xx retry → 1 message, 1 account.
   - Cover reopen after send → no new provisional, drops into existing conversation.
   - **Fingerprint-vs-cookie separation (v4 · founder-tightened):** a four-step sequence proving that the resolver depends on the cookie, not on the fingerprint, and that a valid cookie always resolves to its bound account regardless of fingerprint.
     - **Step 1:** cover #1 · valid `nex_session` cookie A · fingerprint X → assert account A created.
     - **Step 2:** cover #2 · same cookie A · same fingerprint X → assert same account A (cookie continuity).
     - **Step 3a:** separate browser session · **no valid `nex_session`** · same fingerprint X → assert account B created, distinct from A. Proves fingerprint alone MUST NOT resolve identity.
     - **Step 3b:** separate browser session · **valid `nex_session` for account B** · same fingerprint X → assert resolves to account B. Proves the resolver honours the cookie's account binding regardless of fingerprint match against another account.
     If Step 3a ever produces account A, that is a doctrinal regression per §7A and MUST block merge. If Step 3b ever produces account A (or creates a new account C instead of resolving to B), that is a resolver bug and MUST also block merge.
3. **Doctrine:** `[data-nex-cover-skin]` accent CSS var flows into composer rim; visual regression test asserts composer matches peer-chat composer at pixel level (allow 2% tolerance).
4. **Crypto (v3 · founder-strengthened):** integration test proves no plaintext `message_text` reaches `nex_peer_message`, application logs (structured logger + stderr), error payloads (500 response bodies, Sentry events if configured), or any telemetry event when the message originates from a provisional cover-composer send. Testing only the database column is insufficient — the classic failure is `DB encrypted / logger.error(message_text)`. Test asserts absence of the plaintext across all four sinks.
5. **NEX1 welcome:** provisional account creation fires exactly one welcome message from the NEX1 canonical support account (Bridge 62 hook, verified in a dedicated test).
6. **RLS (v3 · founder-clarified):** the provisional actor may read only messages authorised to that actor. The conversation owner may read messages in conversations where they are an authorised participant. No unrelated authenticated NEX user may read the provisional actor's messages. Test asserts all three access classes explicitly:
   - Provisional user (sender) reading their own conversation → **allowed**.
   - Conversation owner reading messages sent to them by the provisional → **allowed** (this is the entire product — the owner receives the message).
   - Any third authenticated NEX account not party to the conversation → **denied**.
   Existing Bridge 3 peer-message RLS policies already model participant-based access; Bridge 99 must not weaken them and must add a coverage test in the acceptance harness that specifically exercises the third-party denial path.

## 14 · Not in scope (deferred, documented)

- Owner-level risk-scoring overrides UI.
- Bisnis inbox filter tabs.
- Claim credential attach flow beyond face-verify (already exists via `/settings/profile` — we're just reusing).
- Multi-device claim consolidation (B99+claim-migrate).
- Server-side encrypted-keypair backup for cross-device provisional migration.
- Cover-to-cover direct threading between two provisional accounts (v1 only supports visitor → owner, never provisional → provisional).

## 15 · Open questions (need founder input before implementation)

| # | Question | Recommended default |
|---|----------|--------------------|
| Q1 | Should the `Skip for now` button also fire an analytics event so we can measure claim conversion? | Yes. Event: `bridge99_claim_deferred` with `account_id`, `origin_cover_business_id` (read from the conversation row per §5 Part B), and `claimed_at` (which will be NULL at this moment, per §2A telemetry rule). **Telemetry MUST NOT be used to reconstruct cross-cover behavioural profiles of provisional users.** No aggregation query, dashboard, or downstream table may materialise a per-account list of every cover the actor has visited. If such an aggregation is ever required for a legitimate product purpose, it requires founder review and MUST operate on claimed accounts only. |
| Q2 | If a claimed user visits a cover where they've never messaged the owner, does the composer preview a "Say hi to Maria" nudge? | No in v1 — composer stays neutral. Nudge is a Bridge 100+ growth experiment. |
| Q3 | Should provisional accounts count against Gratis owner's inbound message limits? | No — inbound has no doctrinal limit; only outbound boosted messages are metered. **Operational validation required before production (v3 · founder-flagged):** because there is no inbound cap, the risk-service thresholds in §8 become the sole line of defence against one abusive actor spinning up 500 provisional accounts to spam 500 businesses. The `new_conversations_last_hour`, `same_message_hash_repeat_count`, and `ip_reputation_score` thresholds MUST be validated against a synthetic-abuse harness before Bridge 99 ships. Doctrine unchanged; operational tuning must precede rollout. |
| ~~Q4~~ | ~~Salt rotation cadence for `provisional_fingerprint`?~~ | **Answered in §7A: 30-day rotation, 7-day overlap.** |
| ~~Q5~~ | ~~Default `display_name` for a provisional account?~~ | **Answered in §7B: `'New visitor'`.** |
| Q6 | Does the cover composer support attachments (photos, files) in v1? | **No.** Text-only for first message. Attachments are B99+attach follow-up (also requires the phone-is-database encrypted-attachment work still pending from B81+). |
| Q7 | Rate-limit response text — do we surface "you're sending too fast" vs a generic challenge? | Challenge kind should render neutral copy: "Please confirm you're not a bot." Not "you're suspicious." **UX refinement (v3 · founder-preferred):** implement as silent-first — an invisible turnstile check runs on every send, passes silently for the normal user, and only escalates to the visible "Please confirm you're not a bot." copy when the invisible mechanism fails or a higher risk threshold is reached. Silent-first is preferred, not required for v1; the visible fallback copy is unchanged either way. |
| ~~Q8~~ | ~~Welcome outbox mechanism~~ | **Founder-accepted 2026-09-30:** option (a). Migration 103 introduces `nex_welcome_outbox`, scoped only to Bridge 99's provisional-create path. Bridge 62's existing inline path continues for non-provisional creates. Any future refactor of Bridge 62 to route through the same outbox is a separate bridge, not part of Bridge 99. This bounding is deliberate. |

## 16 · Founder sign-off checklist

Please confirm each before implementation begins:

- [ ] L1–L4 decisions are final as written in §1.
- [ ] A1, A2, and A3 acceptance criteria are final as written in §2.
- [ ] **§7B activation-boundary** is accepted: provisional account is born on first Send, NOT on Cover open. Merely opening a Cover does not provision.
- [ ] **§2A · Continuity ≠ Verification** is accepted as a locked principle. The doctrine sentence, the three "consequences" bullets, and the requirement to carry `claimed_at` in telemetry are all binding.
- [ ] **Migration 102 v3 schema** is approved (§5). Specifically:
  - [ ] `provisional_fingerprint` lives in the new `nex_account_risk_signal` table with no authenticated RLS policies, NOT on `nex_account`.
  - [ ] `origin_cover_business_id` lives on `nex_peer_conversation`, NOT on `nex_account`.
  - [ ] `nex_account` gains only `claimed_at`.
  - [ ] `nex_peer_message` gains `send_intent_id` with `UNIQUE (sender_id, send_intent_id)`.
  - [ ] Migration 103 introduces `nex_welcome_outbox` scoped only to Bridge 99's provisional-create path (Q8 founder-accepted).
- [ ] Idempotency precedence chain (§7) is approved.
- [ ] **§7 Cookie contract (v4)** is approved. Specifically:
  - [ ] `Secure`, `HttpOnly`, `SameSite=Lax`, signed HMAC, explicit `Max-Age`, explicit `Domain`/`Path` scope.
  - [ ] Any shared-subdomain scope (`.nex.com`) is a security trust boundary and reviewed on that basis.
  - [ ] **v5:** Signed payload includes a unique per-instance `session_id` (jti); server-side revocation operates on that identifier, not on the account.
  - [ ] **v5:** Validity check is `signature_matches AND now < expires_at AND session_id NOT IN revoked_sessions` — all three required.
  - [ ] Server-side revocation exists and is exercised by `/settings/reset-cover-continuity` (revokes the specific presented `session_id`).
  - [ ] Signing-key rotation procedure is documented (cadence + overlap window).
- [ ] **Cover-visit-vs-abandonment rule (§7 + §7B v5)** is approved:
  - [ ] Cover visits and cookie re-presentation do NOT update `last_activity_at`.
  - [ ] **v5:** Owner-side reads, replies, starring, archiving do NOT update the visitor's `last_activity_at`. Visitor lifecycle is independent of owner activity.
  - [ ] Formula is `GREATEST(created_at, MAX(sent_message_at), MAX(claim_interaction_at))` — no owner activity term.
- [ ] **§7A · Fingerprint hardening** is approved. Specifically:
  - [ ] The signal whitelist (device_id, UA class, IP /24, tz offset, accept-language primary) is exhaustive; nothing may be added without founder review.
  - [ ] The out-of-scope list (canvas / WebGL / screen / fonts / battery / geolocation / etc.) is binding — no exceptions.
  - [ ] 30-day salt rotation with 7-day overlap is accepted.
  - [ ] **Fingerprint is REMOVED from the identity resolver** and lives only in the risk-scoring service (§7 v3 precedence + §7A false-positives paragraph). This is the load-bearing v3 correction.
  - [ ] **Migration 102 has NO unique index** on `provisional_fingerprint` (§5 v3). The v1 draft's partial unique index is deleted from the plan.
  - [ ] User-facing escape-valve label is "Start fresh on Covers" (internal route `/settings/reset-cover-continuity`) — accepted as a required feature, not optional.
- [ ] **§7B · Provisional lifecycle** is approved. Specifically:
  - [ ] 60-day soft idle / 90-day hard purge cadence is accepted.
  - [ ] Provisional accounts CANNOT initiate conversations with arbitrary NEX users (only owners they messaged from a cover) is accepted as a v1 constraint.
  - [ ] Merge-on-claim is deferred (no automatic identity consolidation, ever) — user-initiated only, and not in v1.
  - [ ] Multi-device-before-claim = separate identities is accepted as doctrinally correct, not a bug.
  - [ ] Grace claim window after purge is deliberately rejected (purge is irreversible).
  - [ ] **Create paragraph v3** is accepted: DB transaction is atomic; session cookie issuance + NEX1 welcome delivery are post-commit + idempotent; welcome flows through a durable outbox event, not an inline enqueue.
  - [ ] **Account deletion ≠ message deletion** distinction is accepted: no `retained_by_owner=true` flag; no new retention subsystem; owner-side message record follows existing message-retention policy independent of account lifecycle.
  - [ ] Doctrine sentence v3 wording ("ephemeral NEX account with best-effort device/session continuity") is accepted, replacing the "device-bound" phrasing from v2.
- [ ] Risk-service v1 thresholds (§8) are approved as opening defaults.
- [ ] UX copy in §9 is approved verbatim (this is doctrine-adjacent — copy shifts change the feel).
- [ ] Q1–Q7 answered. Q4, Q5, Q8 already resolved by §7A/§7B/prior founder acceptance. **Q1 v3 addendum** ("Telemetry MUST NOT be used to reconstruct cross-cover behavioural profiles") is accepted. **Q3 operational validation** (synthetic-abuse harness against risk thresholds) is committed to before rollout. **Q7 silent-first challenge** UX refinement is accepted as preferred but not blocking.
- [ ] **§13 acceptance criteria v3/v4/v5 corrections** are approved:
  - [ ] **v5:** A2's fingerprint-vs-cookie separation is a FOUR-step sequence (Step 1, 2, 3a, 3b), not three. Step 3a proves fingerprint doesn't resolve identity; Step 3b proves a valid session for account B resolves to B regardless of colliding fingerprint.
  - [ ] Crypto test scope covers DB + logs + error payloads + telemetry, not just DB.
  - [ ] RLS test explicitly exercises all three access classes (provisional sender / conversation owner / unrelated third party).
  - [ ] Any "subpoena-safe" language has been removed from the plan; only factual crypto statements remain.

**Operational-acceptance condition (v5 · founder-required, blocks green-tick even after §16 sign-off):**
- [ ] Synthetic-abuse harness (Q3) has actually run and demonstrated risk thresholds throttle 500-account/500-business abuse without breaking legitimate first conversations.
- [ ] All §13 acceptance tests (A1, A2 including Steps 1/2/3a/3b, A3, crypto four-sink, NEX1 once-only, RLS three-class) actually pass in CI, not just exist.
- [ ] Cookie revocation `session_id`-based path has been exercised end-to-end (issue → use → revoke via `/settings/reset-cover-continuity` → subsequent request is rejected despite valid signature).
- [ ] Migration 102 and 103 applied to `ijvqdvsvwtwxzcqmoqit` cleanly; verification script confirms schema shape matches §5.

§16 checklist ticks approve the DOCTRINE; the operational-acceptance list above must additionally pass before Bridge 99 is considered SHIPPED.
- [ ] File plan (§6) is approved; if any file placement is wrong, correct it before code lands.

## 17 · Implementation order (once signed off)

1. Migration 102 applied to `ijvqdvsvwtwxzcqmoqit` via `scripts/apply-nex-migrations-*.mjs`.
2. `provisional-fingerprint.ts` + `risk-signals.ts` + `risk-service.ts` (pure, unit-tested first).
3. `provisional-account-service.ts` (get-or-create with idempotent upsert).
4. `first-message-orchestrator.ts` (composes: fingerprint → account → risk → encrypt → persist → NEX1 hook → redirect payload).
5. `POST /api/nex-native/first-message` route.
6. `useCoverSendMessage.ts` client hook.
7. `CoverComposer.tsx` primitive + wire into each of 10 layouts (`layouts.tsx`).
8. `ClaimBanner.tsx` + `?born=1` consumer on `/chat/peer/[accountId]`.
9. Owner inbox chip on same page (`claimed_at IS NULL` render branch).
10. Playwright A1 test + `verify-bridge99-idempotency.mts` A2 harness.
11. Manual QA against http://localhost:3008/nex-native/cover/preview/cafe and 3 other layouts, on desktop + mobile viewport.
12. Commit as `Bridge 99 · First Conversation Principle · cover composer + provisional identity + risk service`. Do not squash across the sealed migration boundary.

---

**End of Bridge 99 plan.** Awaiting founder sign-off per §16.
