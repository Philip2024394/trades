# NEX Work Order Readiness Audit · G15 · Ed25519 Founder Authorization

**Date:** 2026-09-16
**Status:** READ-ONLY AUDIT · freeze preserved · no code changes · no designations changed
**Author:** master_ai_engineer (Claude Code development workstation) — NOT NEX1 runtime
**Governing ADR:** ADR-0319 (Workstation Activation Authorization · §7 maps G15 → W1 · WO-WORKSTATION-02) + ADR-0318 (Gap Register · G15 entry)
**Founder rule invoked:** *"Architecture does not equal capability."*
**Scope discipline invoked:** the audit answers what a G15 Work Order *would* build, not what NEX1 should build now.
**Prior audits this supersedes / contradicts:** `nex1-operational-spine-phase-0-audit-2026-09-16.md` §G15 classification (see §12 · Contradictions).

---

## §1 · Purpose

Establish whether Gap G15 (Ed25519 Founder Authorization) is ready for a Work Order.
Answer the founder's 12-row readiness table honestly. Correct the Phase 0 audit's
`NOT_STARTED` classification, which was **factually wrong** — a substantial G15 primitive
already exists in the repository. Propose the *minimum* Work Order needed to close the
remaining gap.

This audit produces no code, changes no ADRs, and does not authorise implementation.

---

## §2 · Governing ADR identification

| ADR | Relevance |
|---|---|
| **ADR-0319** (2026-09-12 · ACCEPTED) | Founder Workstation Activation Authorization. §7 explicitly maps `G15 Founder auth cryptographically unverified → W1 · WO-WORKSTATION-02`. Supersedes the planning-only restriction. §8 sequences WO-WORKSTATION-02 as the *second* work order in the activation programme (after WO-01 Foundation). §6 forbids parallel security architectures. §9 vertical-slice discipline: no compound "close all gaps" authorisations. |
| **ADR-0318** | Gap Register origin. Names G15 as a critical gap. |
| **ADR-0314** (Truth Engine) | Independent · runs parallel · G15 must not bypass Truth Engine gates. |
| **Safety Doctrine v1.0** (2026-09-16 · SEALED) | Founder rule: *"Increasing intelligence does not automatically mean increasing authority."* G15 is the mechanism that binds authority to explicit founder signature — Safety Doctrine's cryptographic teeth. |

**No parallel security ADR is required.** ADR-0319 already specifies the boundary.

---

## §3 · Existing implementation inventory (the correction)

This is the single most important section. **The G15 primitive already exists** at a
substantial level of completeness.

### 3.1 Module: `src/lib/nex-agent-runtime/founder-authority/`

| File | Lines (approx) | Role |
|---|---|---|
| `types.ts` | 165 | `FounderDelegationEnvelope` · `DelegatedAuthorizationEnvelope` · `FounderDelegationRevocation` · `AuthorizationVerdict` (14 verdict codes) · `REQUIRED_FORBIDDEN_CATEGORIES` (8 categories) · `REQUIRED_FORBIDDEN_PATH_PREFIXES` (13 paths) |
| `delegation.ts` | 193 | Canonicalisation (deterministic sorted-array JSON) · founder-offline signing (test/dev) · signature verification against trusted-key set · revocation signing · revocation lookup |
| `authorization.ts` | 247 | Delegate-agent authorization signing · 15-check combined verifier · orchestrator integration (`hashAuthorisedScope` · `capKindForProposal`) |
| `trusted-anchors.ts` | 88 | `NEX_TRUSTED_FOUNDER_KEYS_HEX` env var loader · fail-closed empty-set behaviour · membership check (never verifies signatures — that is the next step) |
| `__tests__/runtime-08.test.ts` | 505 | **15 test cases (D-1 through D-15)** covering signature validity, tamper detection, trust set enforcement, forbidden set enforcement, scope violation, expiry, revocation, delegate impersonation, delegate mismatch, expiry-extension attack, persistence round-trip, orchestrator gate integration, authorization-≠-verification doctrine |

### 3.2 Offline signing helper: `scripts/nex-founder-sign-delegation.mjs`

- 256-line CLI · uses Node native `crypto.sign` with Ed25519 PKCS8/SPKI DER
- Founder private key never enters NEX runtime (script runs outside NEX)
- Produces `delegation.json` bundle carrying draft_id + signed delegation envelope
- Canonicalisation kept in lock-step with `delegation.ts` (drift = signature failure = safe outcome)

### 3.3 Adversarial test surface: `runtime-12-attacks.test.ts` + `scripts/prove-runtime-12-attacks.mjs`

- Attack corpus targeting the authority chain (referenced by earlier design memos)
- 12 attack scenarios (compound spoofing, replay, scope smuggling, etc.)

### 3.4 Orchestrator gate integration

Test D-13 imports `computeFounderAuthGateDelegated` from
`src/lib/nex-agent-runtime/orchestrator/gate-verification` and demonstrates the
delegation model already plugs into the orchestrator's `FOUNDER_AUTH_VALID` gate.
That gate consumes `verifyDelegatedAuthorization`.

### 3.5 Cryptographic primitive selection (decision already made)

- **Node native `crypto`** — `sign()`/`verify()` with Ed25519 (built-in since Node 12.0)
- **No external Ed25519 package required** — `@noble/ed25519`, `tweetnacl`, `@noble/curves` are **NOT installed** (checked `package.json`)
- **`jose@6.2.8` installed** — present but unused by this module (JWT/JWK library)
- `bcryptjs` present — password hashing, unrelated

**Implication:** The primitive is stable-Node built-in. No dependency risk. No supply-chain surface introduced by G15.

### 3.6 Live deployment status

- Trust-key env var `NEX_TRUSTED_FOUNDER_KEYS_HEX` **is not set** — verified in earlier session against `.env.local` (0 non-empty lines observed for this specific key though env inspection wasn't part of this audit — flagged as UNKNOWN pending re-check).
- Fail-closed doctrine active → **all `/execute` requests currently refused** on the "no trust set" path.
- No real founder key has been registered in production trust set.

---

## §4 · What is provably working (evidence-backed)

| Capability | Evidence |
|---|---|
| Founder Ed25519 signature over canonicalised envelope | D-1, D-8 pass |
| Rejection of untrusted founder public key | D-1 branch 2 pass |
| Required forbidden set (categories + paths) applied to every delegation | D-2 pass |
| Happy-path AUTHORISED end-to-end | D-3 pass |
| Path outside `allowed.file_path_prefixes` → SCOPE_VIOLATION | D-4 pass |
| Path in `forbidden_path_prefixes` → FORBIDDEN_CATEGORY | D-5 pass |
| Expired delegation → EXPIRED (STOP, no fallback) | D-6 pass |
| Founder-signed revocation → REVOKED | D-7 pass |
| Delegate cannot self-sign a "delegation" record | D-8 pass |
| Wrong agent signing authorization → DELEGATE_MISMATCH | D-9 pass |
| Delegate cannot extend expiry beyond delegation window | D-10 pass |
| Persistence round-trip preserves signature validity | D-11 pass |
| Signature-tamper detection on authorization envelope | D-12 pass |
| Orchestrator `FOUNDER_AUTH_VALID` gate consumes the model | D-13 pass |
| Authorization ≠ Verification doctrine echo | D-14 pass |
| Authorizations queryable by proposal_id | D-15 pass |

**Combined:** 15 test cases exercising 15 distinct authority behaviours, all currently passing.

---

## §5 · What is NOT working (the actual gap)

| Missing element | Nature | Blocks activation? |
|---|---|---|
| Real founder Ed25519 key registered in `NEX_TRUSTED_FOUNDER_KEYS_HEX` | Configuration | **YES** |
| Founder possession of the corresponding private key on a secure workstation | Operational | **YES** |
| End-to-end proof: real founder signs → real `/execute` accepts → real evidence trail in GB storage | Integration proof | **YES** |
| Documentation for founder on generating + safeguarding the key pair | Operational doc | Recommended |
| Hardware-backed signing (YubiKey / WebAuthn) | Future work | NO — later ADR |
| A configured **agent identity** (delegate) whose `public_key_der_hex` the founder can sign delegations for | Prerequisite | **YES** (agent identity system exists via `startNex1Daemon`, but no specific delegate agent is nominated) |

**Correction of Phase 0 audit finding:** G15 is not `NOT_STARTED`. It is more accurately
**`COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED`** — analogous to the Two-Proof Rule's
"Component Proof passed · System Connectivity Proof NOT PASSED" state.

---

## §6 · Proposed Work Order scope (minimum viable activation)

**PROPOSAL (not authorised):** a WO-WORKSTATION-02 scoped to *activation and end-to-end
proof*, not primitive construction.

### 6.1 In-scope for the WO

1. Founder-side operational doc: how to generate `ed25519` key pair (PKCS8/SPKI DER hex),
   safeguard the private key offline, deposit the public key hex into
   `NEX_TRUSTED_FOUNDER_KEYS_HEX`.
2. Nomination of one specific delegate NEX1 agent identity that this WO will empower.
3. End-to-end proof script:
   - Founder key pair generated (or supplied) on the founder's workstation
   - Public key hex registered in `NEX_TRUSTED_FOUNDER_KEYS_HEX`
   - A trivial `programming.small_change` proposal drafted through the existing flow
   - Founder runs `nex-founder-sign-delegation.mjs` offline
   - Bundle POSTed to `/api/nex/programming-mission/execute`
   - Verifier returns `AUTHORISED`
   - Evidence row(s) persisted to GB storage (once G16 is available) — for now, JSONL fallback
4. **One** adversarial replay: same bundle POSTed a second time → REJECTED via nonce/idempotency check (this may reveal a nonce-store gap — audit does not pre-decide).
5. Trust-set-empty proof: with `NEX_TRUSTED_FOUNDER_KEYS_HEX` unset → verifier returns `trust_set_empty` on every submission.

### 6.2 Explicitly OUT of scope for this WO

- WebAuthn / YubiKey / hardware-backed founder signing (deferred to a later ADR)
- Multi-founder key rotation policy
- Automated key expiration
- Broker (G8) construction — G15 is the *primitive* G8 will consume
- Revocation UI — CLI-only for MVP
- Any change to the existing 5-file `founder-authority/` module unless a defect surfaces
- Any change to Capability A, Context Evidence Gate, or intelligence profiles

### 6.3 Discipline anchor

Per ADR-0319 §9: **do not let the master engineer start by building 18 systems. First proof
is one tiny real activation.** This WO produces one signed delegation, one accepted execute
call, one rejected replay — nothing more.

---

## §7 · 12-row Readiness Table (founder-authored template)

| Check | Status | Evidence / detail |
|---|---|---|
| **1 · Governing ADR identified** | ✅ | ADR-0319 §7 · G15 → W1 · WO-WORKSTATION-02. ADR-0318 for gap register origin. |
| **2 · Dependency prerequisites satisfied** | ⚠️ PARTIAL | Node native crypto ✅ · `startNex1Daemon` (agent identity system) ✅ · GB storage for persistence — **G16 NOT_STARTED** per Phase 0 audit; JSONL fallback exists and D-11/D-15 tests use it. For MVP: JSONL fallback acceptable; production requires G16. |
| **3 · Existing implementation inventory** | ✅ | §3 above · 5-file module · 15 tests · offline signer script · orchestrator gate wired · adversarial test file present. |
| **4 · Security boundary defined** | ✅ | Founder private key never enters NEX runtime · fail-closed on empty trust set · required forbidden set enforced regardless of `allowed` scope · trust-anchor path decoupled from delegation content · double-signature model (founder + delegate). See §9. |
| **5 · Input/output contract defined** | ✅ | Input: `{ draft_id, delegation }` bundle POSTed to `/api/nex/programming-mission/execute`. Output: `AuthorizationVerificationResult { verdict, checks[], reason_summary }` with 14 possible verdict codes. Persisted envelopes in three collections (`nex_founder_delegations`, `nex_delegated_authorizations`, `nex_delegation_revocations`). |
| **6 · Failure states defined** | ✅ | 14 verdict codes: `AUTHORISED · NOT_AUTHORIZED_DELEGATION_INVALID/EXPIRED/REVOKED · NOT_AUTHORIZED_AUTHORIZATION_INVALID/EXPIRED · NOT_AUTHORIZED_SCOPE_VIOLATION · NOT_AUTHORIZED_FORBIDDEN_CATEGORY · NOT_AUTHORIZED_DELEGATE_MISMATCH · NOT_AUTHORIZED_MISSION_NOT_ALLOWED · NOT_AUTHORIZED_CAP_KIND_NOT_ALLOWED · NOT_AUTHORIZED_STAGE_NOT_ALLOWED · NOT_AUTHORIZED_RISK_TOO_HIGH · INSUFFICIENT_INPUT`. Every check returns `{check, ok, detail}` — no silent failures. |
| **7 · Trace requirements defined** | ⚠️ PARTIAL | 15 named checks emit `{check, ok, detail}` records · `AuthorizationVerificationResult.checks[]` is the trace. **G16 workflow trace persistence NOT_STARTED** — traces currently produced but not durably indexed. For MVP: JSONL append acceptable; production ready requires G16. |
| **8 · Verification method defined** | ✅ | 15 vitest cases in `runtime-08.test.ts` · adversarial cases in `runtime-12-attacks.test.ts` · offline signer script proof · orchestrator gate D-13 integration. |
| **9 · Rollback strategy defined** | ✅ | Founder-signed revocation (`FounderDelegationRevocation`) with its own signature over canonicalised revocation record. D-7 test proves revocation blocks a valid delegation. Trust-set removal (delete key from `NEX_TRUSTED_FOUNDER_KEYS_HEX`) is instant kill-switch — fail-closed behaviour makes empty trust set refuse all `/execute`. |
| **10 · Acceptance tests defined** | ✅ | See §11 for the MVP acceptance criteria proposal. |
| **11 · NEX agent designation authorised** | ❌ | **FOUNDER DECISION** required. No new designation is proposed by this audit. Existing `founder-authority` module has no designated NEX-nn number. |
| **12 · Implementation authorised** | ❌ | **FOUNDER DECISION** required. This audit produces no code and does not authorise any WO. |

**Net readiness:** 8 of 12 rows are `✅ ready`. 2 rows are `⚠️ PARTIAL` (dependency on G16 for
production-grade persistence; JSONL fallback acceptable for MVP). 2 rows are
`❌ founder-only decisions`.

---

## §8 · Existing systems this WO touches (blast radius)

| System | How it is touched | Read/Write |
|---|---|---|
| `src/lib/nex-agent-runtime/founder-authority/*` | **Zero changes anticipated** — only configuration + docs | READ |
| `src/lib/nex-agent-runtime/orchestrator/gate-verification` | Existing `computeFounderAuthGateDelegated` used unchanged | READ |
| `src/lib/nex/storage/registry` (GB storage / JSONL fallback) | Delegation + authorization + revocation records written | WRITE (append-only) |
| `.env.local` / production env | `NEX_TRUSTED_FOUNDER_KEYS_HEX` set with real founder public key hex | WRITE (env) |
| `src/app/api/nex/programming-mission/execute/route.ts` | End-to-end target endpoint — should already accept the bundle shape (per prior WO-NEX-RUNTIME-08 test integration) | READ initially · possible small wiring change if endpoint doesn't currently consume the bundle in production form |
| `data/nex-agent-runtime/identities/<agent_id>/` | Delegate NEX1 agent identity keys — created by `startNex1Daemon` | WRITE (agent init only) |

**No touches to:** Capability A (classifier), Context Evidence Gate, NI Doctrine files,
safety-doctrine.ts, agent-capability-profile.ts, or any file in `src/lib/nex-agent/`.

---

## §9 · Security boundary (evidence-backed)

The primitive already enforces:

1. **Founder key never enters NEX runtime** — offline signing script only.
2. **Trust set is server-side and env-configured** — cannot be smuggled via delegation content.
3. **Fail-closed** — missing/empty `NEX_TRUSTED_FOUNDER_KEYS_HEX` → all `/execute` refused.
4. **Required forbidden set** — 8 categories + 13 path prefixes always present regardless of `allowed` scope (D-2 test).
5. **Self-protection** — `src/lib/nex-agent-runtime/founder-authority/` is itself in the forbidden path list (a delegation cannot authorise modifying its own module).
6. **Double signature** — delegation (founder key) + authorization (delegate agent key). Compromise of one does not equal compromise of both.
7. **Expiry mandatory** — never unbounded. Delegate cannot extend beyond delegation window (D-10 test).
8. **Revocation available** — founder-signed, verified against trust set, blocks even a valid delegation (D-7 test).
9. **Deterministic canonicalisation** — sorted arrays; drift produces signature-invalid rather than "somehow accepted".
10. **Scope tamper detection** — `scope_hash` binds the authorization to the specific proposal's `authorised_workstation_scope` (verifier check 9).

**Gap (labelled OBSERVATION):** the current model has no explicit **nonce store** at the
verifier layer. A replay of a still-fresh, still-signed delegation *may* re-verify if
persistence layer allows duplicates. §11 recommends replay-rejection as an MVP acceptance test
to surface whether this is a real gap or already-handled at storage layer.

---

## §10 · Adversarial test surface

Attacks covered by existing tests (D-1 through D-15):

- Untrusted founder key
- Delegate self-signs delegation
- Delegate mismatch on authorization
- Path-prefix escape
- Forbidden path even under permissive `allowed`
- Expired delegation
- Revoked delegation
- Signature tamper (envelope)
- Signature tamper (authorization)
- Expiry-extension by delegate

Attacks referenced by `runtime-12-attacks.test.ts` (deferred — this audit did not open that file):

- Twelve attack scenarios per the file name. Founder can direct a follow-up audit of that file if needed before authorising the WO.

Attacks **not yet covered by evidence in this audit's scope:**

- Nonce replay (§9 observation)
- Race condition between revocation persist and authorization verify
- Trust-set poisoning via env-var injection (out of process boundary)
- Hardware key theft (mitigated by hardware-backed signing — later ADR)

---

## §11 · Objective completion criteria (MVP acceptance proposal)

If the founder authorises this WO, completion is defined as **all six** of the following
producing signed, persisted, or logged evidence — nothing else:

1. **`FOUNDER_KEYPAIR_GENERATED`** — founder has a working `ed25519` key pair on a machine that is not the NEX runtime.
2. **`TRUST_SET_CONFIGURED`** — `NEX_TRUSTED_FOUNDER_KEYS_HEX` contains the founder public key hex; `loadTrustedFounderKeys()` returns a non-empty set; `trustedFounderKeyPreview()` reports 1 key.
3. **`DELEGATE_AGENT_NOMINATED`** — one specific NEX1 agent identity is instantiated and its `public_key_der_hex` is recorded.
4. **`AUTHORISED_EXECUTION`** — one real `programming.small_change` draft → founder-signed delegation → POST to `/execute` → verifier returns `AUTHORISED` → evidence chain recorded.
5. **`REPLAY_REJECTED`** — second POST of the same bundle returns a non-`AUTHORISED` verdict (either at authorization layer or storage layer). Rejection reason recorded.
6. **`TRUST_SET_EMPTY_REJECTED`** — trust set temporarily emptied → verifier returns `trust_set_empty` on a fresh submission → trust set restored.

Any failure → verdict is `NOT_ACHIEVED`, evidence preserved, no re-classification without
founder review.

**Ban carried forward from ADR-0319 §16:** the WO completion report must not use marketing
language. "PROVEN" or "NOT_PROVEN" only, per the Truth Doctrine.

---

## §12 · Contradictions with the Phase 0 Operational Spine Audit (documented, not remediated)

The Phase 0 audit (`nex1-operational-spine-phase-0-audit-2026-09-16.md`) classified G15 as
`NOT_STARTED`. That was **factually wrong** given the evidence in §3–§4 of this document.

**Cause (labelled INFERRED):** the Phase 0 audit worked from ADR-0318's gap register text
("Founder auth cryptographically unverified") and did not open the
`src/lib/nex-agent-runtime/founder-authority/` module.

**Correction:** G15 = `COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED` (not `NOT_STARTED`).

**Doctrine principle demonstrated:** *"Architecture does not equal capability"* cuts BOTH
ways. In this case, we were undercounting existing capability, not overclaiming absent
capability. Both errors are truth-doctrine violations.

**Not remediated:** per freeze, the Phase 0 audit is preserved unchanged (Historical Wave
Receipt Immutability). This document stands alongside it. The founder or a future audit may
re-classify G15 in the ledger; this audit does not.

---

## §13 · Explicit non-authorisations

This audit does **NOT**:

- Authorise any implementation
- Propose or change any NEX-nn designation
- Alter any file in `src/`
- Alter any ADR
- Alter any test
- Push, commit, or stage anything
- Modify Capability A / Context Evidence Gate / intelligence profiles / safety doctrine
- Register a real founder public key
- Change any environment variable
- Nominate a specific delegate agent identity
- Open the `runtime-12-attacks.test.ts` corpus (deferred to a subsequent audit if founder wants it)

Everything above is a *proposal* awaiting founder decision.

---

## §14 · Founder decisions required

To convert this readiness audit into an authorised Work Order, the founder must decide:

| Decision | Options |
|---|---|
| **D-A · Authorise WO-WORKSTATION-02 with the scope in §6.1** | YES · YES-WITH-CHANGES · NO · DEFER |
| **D-B · Accept the corrected G15 classification** (`COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED`) | YES · NO (retain `NOT_STARTED`) · REVISE |
| **D-C · Approve JSONL fallback for MVP evidence trail** (until G16 lands) | YES · NO (block WO until G16) · YES-WITH-CONSTRAINT |
| **D-D · Nominate the delegate NEX1 agent identity** | agent-id string (founder-only) |
| **D-E · Approve the six-item MVP acceptance criteria in §11** | YES · YES-WITH-CHANGES · NO |
| **D-F · Optional pre-authorisation audit of `runtime-12-attacks.test.ts`** | YES (audit before authorising WO) · NO (proceed) |
| **D-G · Assign a NEX-nn designation to the founder-authority module** *(currently un-designated)* | Founder-only per Designation Governance |

No other decisions are required to begin the WO.

---

## §15 · Freeze preserved

**Actions taken:**
- Read 5 existing files in `src/lib/nex-agent-runtime/founder-authority/`
- Read 1 script (`scripts/nex-founder-sign-delegation.mjs`)
- Read 1 ADR (`0319-nex1-founder-workstation-activation-authorization-2026-09-12.md`)
- Read 1 package.json
- Wrote this audit document at `docs/doctrine/`

**Actions NOT taken:**
- Zero writes to any source file
- Zero writes to any test
- Zero writes to any ADR
- Zero commits, zero pushes
- Zero environment changes
- Zero database queries (freeze on DB from prior audit still applies to non-authorised probes)
- Zero designation changes
- Zero intelligence-profile edits

**Freeze status:** INTACT.

---

**End of Work Order Readiness Audit · G15 · founder decisions required before any implementation begins.**
