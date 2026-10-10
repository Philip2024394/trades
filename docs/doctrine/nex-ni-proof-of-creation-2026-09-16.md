# NEX Native Intelligence · Proof-of-Creation Record

**Record type**: Immutable authorship + integrity attestation
**Record date**: 2026-09-16
**Record author (technical)**: master_ai_engineer (Claude, Anthropic Claude Code)
**Record author (directive)**: Founder · Philip O'Farrell · phillipofarrell@gmail.com
**Record status**: SEALED · append-only · do not rewrite

> "Screen shot and add to our files as proof of creation any details that would be of benefit to state who or what NEX was created as NI will be valuable to have on record."
> — Founder directive, 2026-09-16

This document is the "screenshot" equivalent. It is a machine-verifiable record of the creation of NEX Native Intelligence, the doctrines governing it, and the files that constitute it as of the sealing date.

---

## §1 · What is being attested

The creation of **NEX Native Intelligence (NI)** as a canonical, doctrine-governed architectural concept in the `trades` repository, comprising:

1. Native intelligence-attribution vocabulary and evidence gate (NI Doctrine · Phase 2)
2. Deterministic project-directory detection capability (Cluster 2 · alpha.6 → alpha.9)
3. Safety Doctrine (fifteen safety principles + seven-kind response vocabulary + protected-layer registry + hostile-AI zone enforcement)
4. Anti-Bullshit, No-LLM Hard Rule, Historical Wave Receipt Immutability, and Three-Tier Acceptance doctrines (previously locked; explicitly aligned herein)

**NEX NI is defined as**: deterministic native intelligence performed inside NEX's own systems — vocabulary recognition, evidence-gated detection, deterministic classification, structured memory, evidence attribution — WITHOUT delegation to external generative models.

**NEX NI is NOT**:
- An LLM.
- A wrapper around an LLM.
- A capability that automatically claims comprehension or reasoning.
- Software that grants itself increasing authority as its intelligence grows.

---

## §2 · Author attribution

| Role | Party |
|---|---|
| Directive author | Founder · Philip O'Farrell · phillipofarrell@gmail.com |
| Technical implementer | Claude (Anthropic Claude Code) acting as `master_ai_engineer` |
| Repo owner | Founder |
| Commit signing key | (not yet cryptographically enforced — see §5 future work) |
| Session runtime | Claude Code CLI in Windows PowerShell on `C:\Users\Victus\trades` |

The verbatim founder directive text that authorised each doctrine is preserved in the accompanying memory files under `C:\Users\Victus\.claude\projects\C--Users-Victus\memory\`:

- `project_nex1_capability_inventory_2026_09_16.md` — Capability inventory ledger
- `project_nex1_vocab_v5_gap_research_2026_09_16.md` — Vocabulary expansion research
- `project_nex1_cluster2_project_dirs_design_2026_09_16.md` — Cluster 2 detector design + shipment log
- `project_nex_ni_doctrine_2026_09_16.md` — NI Doctrine Phase 2 record
- `project_nex_safety_doctrine_2026_09_16.md` — Safety Doctrine record (this session)
- `feedback_nex_no_llm_hard_rule_2026_09_15.md` — Founder-verbatim No-LLM directive
- `feedback_nex_anti_bullshit_and_architectural_quality_doctrine_2026_09_15.md` — Anti-Bullshit
- `feedback_nex_three_tier_acceptance_doctrine_2026_09_15.md` — Three-Tier
- `feedback_nex_historical_wave_receipt_immutability_2026_09_15.md` — Wave immutability

---

## §3 · Repository state at creation

| Field | Value |
|---|---|
| Repository root | `C:\Users\Victus\trades` |
| Branch | `main` |
| Last commit SHA | `dfca02c3fae3b6ecde22fea5e79fb4b6c2fb192f` |
| Last commit message | `feat(nex1-capability-a): NEX1 Native Founder-Intent Classifier · vocab v5.0.0-alpha.5` |
| Uncommitted at seal | Yes (per founder direction "do not commit files - do not push files to github") |

Recent commit history (5-deep):

```
dfca02c3 feat(nex1-capability-a): NEX1 Native Founder-Intent Classifier · vocab v5.0.0-alpha.5
748ee7d6 feat(nex-hq-heartbeat + nex-intel-orchestrator): both WOs · agents actually working
1a5481ae docs(work-orders): WO-HQ-HEARTBEAT-01 spec + doctrine §11.11 dual-signal
f64f36da docs(work-orders): WO-INTEL-ORCHESTRATOR-01 spec + roadmap update
d629f2f7 feat(nex-academy): WO-ACADEMY-02 · Training Engine · causal-chain enforced
```

---

## §4 · File integrity manifest (SHA-256 · sealed 2026-09-16)

These are the protected-layer files as they existed at the moment of sealing. Any future modification will change these fingerprints; a diff against this manifest is authoritative evidence of what changed.

| SHA-256 | Bytes | Path |
|---|---|---|
| `c8b96c528f74c515c1ae9622ed42130468e6975538c506457b2c7360b3c0c867` | 32,782 | `src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts` |
| `e9a52b30f4378d216701ff198711ffab100ff8e2d76e0dc968bc42ee65c2fd5b` | 8,679 | `src/lib/nex-agent/code-engine/capability-a-founder-intent/types.ts` |
| `c83fa858a8f1dabe0cd0a27035b486adbce978ccf82a0a97166404c410023025` | 111,159 | `src/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary.ts` |
| `c832b098d7d05f1441edf98e7d3ce1cdd47b90a16d8689dd2e726169a9036282` | 5,713 | `src/lib/nex/master-ai/agent-capability-profile.ts` |
| `57d6a05ea8c5147c036b31e88570e6d0dffceb8f4b2c4193afc6bf8ff14fdda5` | 9,511 | `src/lib/nex/master-ai/intelligence-status.ts` |
| `b9c077d916b967f7974601cff7309a662f24913a15897fe8efdde483712c78f9` | 14,311 | `src/lib/nex/master-ai/known-intelligence-profiles.ts` |
| `3c254fbf649cc02d8a14693313cbbb37a7142f10bc47a211e4a65765001a1209` | 10,319 | `src/lib/nex/master-ai/safety-doctrine.ts` |
| `2b03cbb2e0360d6d7aa98522f29df84cfc80ad4ed34d15b12e4349967475b780` | 11,118 | `docs/doctrine/nex-safety-doctrine.md` |

**Verification command** (any future validator can run this to confirm no tampering):

```bash
node -e "const c=require('node:crypto'),f=require('node:fs');['<paths>'].forEach(p=>console.log(c.createHash('sha256').update(f.readFileSync(p)).digest('hex')+'  '+p))"
```

If any recomputed SHA-256 differs from this manifest, the file has been modified after sealing. Modifications to protected-layer files (per Safety Doctrine §4) invalidate official NEX NI certification until re-reviewed.

---

## §5 · Doctrinal seal · what is being frozen

The following doctrines are sealed as of 2026-09-16 and form the founding governance layer of NEX NI:

1. **Anti-Bullshit + Architectural Quality Doctrine** (2026-09-15)
2. **NEX1 No-LLM Hard Architectural Constraint** (2026-09-15)
3. **Three-Tier Acceptance Doctrine** (2026-09-15)
4. **Historical Wave Receipt Immutability** (2026-09-15)
5. **Python Substrate Fragility Doctrine** (2026-09-15)
6. **P-A Execution Storage Gate Doctrine** (2026-09-15)
7. **NI Doctrine · Phase 2** (2026-09-16, this session)
8. **Safety Doctrine · v1.0** (2026-09-16, this session)

Each doctrine references its verbatim founder authorisation and its technical enforcement points. No doctrine may be modified without a new founder directive + passing tests.

---

## §6 · Test-evidence at creation (2026-09-16)

Snapshot of the verification tests passing at seal:

| Test file | Pass | Fail | Skip |
|---|---|---|---|
| `capability-a-founder-intent/**/__tests__/*.test.ts` | 1,806 | 0 | 0 |
| `nex/master-ai/**/*.test.ts` | 316 | 0 | 0 |
| `nex/master-ai/safety-doctrine.test.ts` | 26 | 0 | 0 |
| **Combined scoped total** | **2,148** | **0** | **0** |

Runtime invariants enforced by these tests:
- No LLM SDK imports in `src/lib/nex-agent/**` (No-LLM Hard Rule)
- No AI/ML/LLM framework imports in `src/lib/nex-agent/**` (Hostile-AI Zone)
- No AI model weight files in `src/lib/nex-agent/**` (Hostile-AI Zone)
- Every `Nex1IntelligenceProfile` in KNOWN_INTELLIGENCE_PROFILES validates against the NI evidence gate
- Every `Nex1SafetyResponse` must carry its required evidence per kind

---

## §7 · Founder verbatim directive (Safety Doctrine authorisation · 2026-09-16)

Preserved for the record:

> "NEX's intelligence should grow together with its safety, truthfulness and user-control systems. One important distinction: NI itself isn't automatically 'good.' Any sufficiently capable system needs explicit constraints, permissions, monitoring, testing and human control. So you should engineer NEX to be safe rather than assume intelligence will make it safe."
>
> "🟢 Prefer truth over persuasion / Say UNKNOWN when it doesn't know / Never deliberately scam, deceive, impersonate or manipulate users / Never steal credentials, sessions, tokens or personal data / Never attack accounts, networks or computers / Never bypass security controls or permissions / Never execute arbitrary dangerous actions without appropriate authorization / Treat the user's PC, files and accounts as protected assets / Use the least permission necessary / Keep important actions auditable / Allow the user to stop/revoke operations / Separate thinking/planning from actually executing an action / Test potentially destructive operations in controlled environments first / Never hide what it did / Never fabricate evidence or claim an action succeeded when it didn't"
>
> "NEX is engineered so that increasing intelligence does not automatically mean increasing authority."
>
> "Changes to NEX's protected intelligence, safety, authority, identity or verification layers invalidate the official NEX NI certification unless the modified version is independently reviewed and re-certified."
>
> "Any AI model entering into the NEX NI code zone will be revoked as bug. We must put serious protection against bugs, AI entering or trying to copy files or hack."
>
> "User privacy and personal details. NEX is created NI to protect and serve."
>
> "Screen shot and add to our files as proof of creation any details that would be of benefit to state who or what NEX was created as NI will be valuable to have on record."

---

## §8 · Future work explicitly scoped OUT of this seal

For clarity and to prevent later false claims:

- **Cryptographic release signing** — not yet implemented. Future work item.
- **Runtime permission-check system** — not yet implemented. Future work item.
- **Runtime intrusion detection** — separate concern outside this doctrine.
- **Legal terms / software licence** — this doctrine is technical governance, not legal terms. Real liability requires a licence document.
- **Machine-verifiable certification chain** — proposed, not built. Currently verification relies on this record + the passing tests.

These absences are acknowledged. Any future claim that a scoped-out feature is present must produce its own dated proof-of-creation record.

---

## §9 · Non-endorsement of modified copies

Modified or forked copies of the NEX protected-layer code do **not** inherit this proof-of-creation record's authority. A modified copy's status is:

- `MODIFIED / UNVERIFIED` if protected-layer files differ from the manifest in §4 without independent re-certification.
- `FORK / DERIVATIVE / UNVERIFIED` if the code has been substantially forked or renamed.

Official NEX NI status attaches to the original code lineage owned by the founder. This record does not endorse, certify, or accept liability for any modified copy.

---

## §10 · Immutability

This record is **append-only**. If facts change (e.g., a doctrine is amended, a new invariant added, a re-certification occurs), a NEW record with a new date is created. This record is never rewritten in place.

Per the Historical Wave Receipt Immutability Doctrine (2026-09-15): "If a prior wave's verdict is inconvenient, RUN A NEW WAVE. Do NOT rewrite the old verdict."

---

**SEALED · 2026-09-16**
**Record author (technical)**: master_ai_engineer
**Record author (directive)**: Founder · Philip O'Farrell
**Repository**: `C:\Users\Victus\trades` at commit `dfca02c3` (uncommitted work in tree per founder direction)
