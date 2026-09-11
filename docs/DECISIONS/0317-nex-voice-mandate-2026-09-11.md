# ADR-0317 · NEX Voice Mandate (R-03) · 🔒 STRUCTURE LOCKED · Specific guidelines PENDING founder authoring

**Status:** 🔒 STRUCTURE LOCKED · founder-authored 2026-09-11 · specific voice guidelines PENDING · Gate 3 remains CLOSED · zero substrate mutation · doctrine only
**Founder:** Philip (structure locked via Stage 1 · specific guidelines authored in future ADR)
**Consumes:** R-03.v1.0.0 · §7.10 M1 (Location cross-Domain metadata · language variants) · §7.7 H1 (`unknown` ≠ `false`)

**Rule version:** R-03.v1.0.0 · **Voice mandate version:** `voice_mandate.v1.0.0` (locks when specific guidelines authored)

---

## Section 1 · Two-tier structural doctrine (locked)

**Two tiers per R-03:**

- **Deterministic tier** — rules that can be mechanically checked · Guardian rejects violations at composer output boundary
- **Subjective tier** — candidate flags for founder review · NEVER auto-promoted

**Deterministic tier · rule types (locked structure):**

1. Banned words / phrases per language variant
2. Required registers / greeting conventions per session
3. Politeness marker presence per language variant
4. Maximum sentence length / complexity thresholds
5. Language-consistency requirements per session (no mixing EN + ID mid-session without explicit user switch)
6. Founder-authored style constraints (brand voice · founder-declared conventions)

**Subjective tier:**
- Tone drift · brand voice · founder-specific style
- Written to candidate-flag queue · founder reviews
- Never blocks composer output autonomously

**Fail-closed default:** `voice_check_disabled_pending_mandate` · subjective tier holds candidate flags · Guardian permits composer output when deterministic-tier rules unauthored (permissive default until founder authors specific rules)

---

## Section 2 · Language variant support (locked)

**Locked language variant list per §7.10 M1 Location cross-Domain metadata:**

- `EN` (canonical English)
- `ID` (Bahasa Indonesia)
- `EN-GB` (UK expansion · Stage 6)
- `EN-US` (US expansion · Stage 6)
- `EN-AU` (Australia expansion · Stage 6)
- `EN-IE` (Ireland expansion · Stage 6)

Additional variants added via founder-authored ADR (per country activation). Country-specific voice guidelines are country-scoped per §7.10 M1.

---

## Section 3 · Pending founder-authoring blocks

Master AI does NOT invent voice guidelines · founder authors in future ADR (candidate slot ADR-0317.pop):

**Per-tier authoring pending:**

| Tier | Content · founder authors specific |
|---|---|
| Deterministic · banned words | Master list per language variant · founder-authored |
| Deterministic · required greetings | Session-start conventions per language · founder-authored |
| Deterministic · politeness markers | Required per language variant · founder-authored |
| Deterministic · max sentence length | Numeric threshold · founder-authored per language variant |
| Deterministic · language consistency | Session-scope rules · founder-authored |
| Subjective · tone drift | Founder-authored review cadence + criteria |
| Subjective · brand voice | Founder-authored brand voice guide · candidate-flag scoring |

**Anti-pattern rules explicitly forbidden by R-03 doctrine (per feedback_observation_is_not_constitutional_authority.md):**
- Master AI cannot infer voice rules from observed composer output
- Master AI cannot compute "best" politeness threshold from user feedback
- Master AI cannot silently update voice mandate based on runtime observation
- Amendments require explicit founder-authored versioning-policy ADR (per D-17 pattern)

---

## Section 4 · Constitutional invariants (locked)

1. **Deterministic tier is mechanically checkable** · reproducible · deterministic across runs
2. **Subjective tier NEVER auto-blocks** composer output · candidate flags only
3. **Language-consistency requirement** enforced per session
4. **Country-scoped variants** authored per country activation (Stage 6)
5. **Amendment path** requires explicit founder-authored versioning-policy ADR (per D-17 pattern)
6. **Fail-closed default** is `voice_check_disabled_pending_mandate` · never `voice_check_failed` when mandate unauthored

---

## Section 5 · Enforcement implications (doctrine · not implemented)

- Guardian rule: composer output evaluated against R-03 deterministic tier at composer boundary
- Guardian rule: deterministic violations rejected · composer must produce alternative output
- Guardian rule: subjective flags written to review queue · never block output
- Truth Engine R-03 verdict records `voice_mandate_version` per evaluation
- Router surfaces voice-violation feedback to composer for correction

**Substrate impact by this ADR:** 0.

- No voice mandate table populated
- No CHECK constraint · no Guardian rule installed
- No composer modification
- Gate 3 CLOSED

---

## Section 6 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | R-03 voice mandate · two-tier evaluation STRUCTURE locked · deterministic + subjective tiers · language variant list locked (EN · ID · EN-GB · EN-US · EN-AU · EN-IE) · specific voice guidelines PENDING founder authoring in ADR-0317.pop · fail-closed to `voice_check_disabled_pending_mandate` |
| **Decided by** | Philip (structure) · founder authors guidelines in future ADR |
| **Decision date** | 2026-09-11 (structure) · guidelines pending |
| **ADR** | 0317 · consumes future 0317.pop · country-specific voice ADRs per Stage 6 |
| **Effective from** | voice_mandate.v1.0.0 (structure) · guidelines pending v1.0.0 population |
| **Supersedes** | none |
| **Reason** | R-03.v1.0.0 established two-tier voice evaluation · this ADR locks structural doctrine + language variant list per §7.10 M1 Location metadata · specific voice guidelines require founder-authored population per feedback_thresholds_are_founder_policy_not_ai_statistics.md pattern generalised to voice policy. |

---

## Section 7 · What this ADR did NOT do

- ❌ No specific voice guidelines authored (founder authors in future ADR)
- ❌ No banned-word list authored
- ❌ No max-sentence-length values assigned
- ❌ No Guardian rule installed · no composer modification
- ❌ No Gate 3 opened

---

## Section 8 · Cross-references

**Consumed by:** ADR-0314e (verifier applies R-03 at composer output) · Stage 6 country expansion ADRs (per country voice guidelines) · ADR-0314a.1 (fixture tests R-03 deterministic + subjective cases)

**Consumes:** R-03.v1.0.0 · §7.10 M1 · §7.7 H1 · D-17 amendment clause · feedback_observation_is_not_constitutional_authority.md

---

**End of ADR-0317 · structure locked · specific voice guidelines pending.**

Master AI STOPS. Awaiting founder review + separate GATE 3 OPEN authorisation.
