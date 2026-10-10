# NEX Family Links UI · Open Decisions for Founder

**Date (estimate):** 2026-10-10 · **Branch:** `nex/directory-work`
**Status:** DECISIONS PENDING · UI build NOT authorised until answered
**Companion to:** `docs/doctrine/nex-family-links-ui-spec-2026-10-10.md` (sealed spec · §7)

> One decision per section. Answer in minutes. Approval unblocks the UI build.

---

## How to answer

Pick one option per decision. Write anything different in "Other". The
recommended default is marked ⭐. Defaults follow the **safety-first
principle**: never deter a genuine request for help · never give a bad
actor an easy path · when in doubt, choose the stricter option.

---

## Decision 1 · Primary-guardian revocation escalation

**Question:** When a party tries to revoke a `guardian_primary` link,
should NEX HQ safety review it before it lands, or is the 72-hour
cooldown + notify-all-guardians flow sufficient on its own?

**Options:**
  - **A) ⭐ Founder-level override (HQ confirms) PLUS the 72h cooldown** — strictest path · HQ catches social-engineering removals before they land · minor human-review latency.
  - **B) 72-hour cooldown + notify-all-guardians only** — fully automated · faster but no human sanity-check for the one revocation type that most hurts a child if abused.
  - **C) Other: ____________**

**Trade-off:** Primary-guardian removal is the single most sensitive
state change in Family Links — a coerced child or a hijacked guardian
account could use B to silently cut the real protector out. HQ review
adds latency measured in hours, not days, and only applies to this one
transition. The 72h cooldown remains in both options; A simply adds a
human in the loop for the terminal step. The asymmetry of harm is
severe (bad outcome >> good outcome delayed).

**Build impact if B is chosen:** Remove the HQ-review Server Action and
the "pending-HQ-review" UI state from `LinkDetailView` · simplify the
revocation state machine · drop one Playwright case.

---

## Decision 2 · Pressure signal direction (post-acceptance)

**Question:** Should the "I feel pressured" signal to HQ be
**bidirectional in time** — i.e. available to a child on an **active**
link (reporting a bad guardian after acceptance), not only on a pending
invitation?

**Options:**
  - **A) ⭐ Yes · available on both pending AND active links** — child can escalate at any point in the relationship · HQ receives signal · guardian is never notified.
  - **B) No · pending invitations only** — simpler surface · but a child who acquires a bad guardian has no in-product safety exit.
  - **C) Other: ____________**

**Trade-off:** Coercion rarely surfaces on day one; it builds. Limiting
the signal to the pending window (B) means a child whose situation
deteriorates after acceptance has no safety channel inside NEX and must
revoke publicly (which may itself trigger retaliation). A preserves the
HQ-only, guardian-never-notified contract. The UI cost is one extra CTA
on `LinkDetailView` for active links. The feature's purpose is child
safety, not invitation hygiene.

**Build impact if B is chosen:** `LinkDetailView` does not render the
"I feel pressured" CTA for `state='active'` · the Server Action gates
pressure-signal submissions to `state='pending'` only · one Playwright
case removed.

---

## Decision 3 · WebAuthn-missing invite copy & flow

**Question:** When a guardian without a registered security key opens
the invite flow, do we **route them to enrol a key inline**, or **block
and send them to Settings** to add one first?

**Options:**
  - **A) ⭐ Block with honest copy · send to Settings** — one canonical place to manage security keys · zero branching invite flow · copy below.
  - **B) Inline enrol inside the invite flow** — higher completion rate for first-time guardians · but duplicates the Settings surface and complicates the invite state machine.
  - **C) Other: ____________**

**Recommended copy for A:**
> **A security key is required to invite a family member.**
> We require a hardware or platform security key before any family link
> can be created. This protects the people you want to link to from
> impersonation.
> **[Add a security key in Settings]**  **[Cancel]**

**Trade-off:** Family Links is a safety feature, not a growth feature.
A guardian who cannot find Settings is a guardian who should pause
before inviting anyone. A keeps the WebAuthn enrol path in exactly one
place (sealed Settings), easier to audit and test, and matches the
"never a magic shortcut" posture of spec §3d. B is more convenient but
introduces a second enrol code path that must be kept in sync forever.

**Build impact if B is chosen:** Add inline `WebAuthnEnrolStep0` to the
invite flow · extend state machine 2b with a `enrolling_security_key`
state · add Playwright case for inline-enrol-then-invite.

---

## Decision 4 · Entry-point placement in `_page-header.tsx`

**Question:** Should Family Links have its own icon in the sealed
`_page-header.tsx` right-cluster, or live only under Settings?

**Options:**
  - **A) ⭐ Settings-only entry (no new header icon)** — preserves the sealed chrome · header stays at 3 icons · one honest discovery path.
  - **B) Add a 4th icon to `_page-header.tsx` right-cluster** — maximum discoverability · but mutates sealed chrome and crowds the cluster.
  - **C) Dashboard tile on `/nex-native` home only (no header icon, no Settings-only)** — surfaces when relevant · requires a tile slot that is not sealed today.
  - **D) Other: ____________**

**Trade-off:** The header is sealed and already carries home · search ·
gear/lock. Adding a fourth icon (B) mutates sealed chrome and sets a
precedent any future top-level feature can claim a slot — a precedent
we do not want. A guardian configuring family links is already in a
configuration mindset, so Settings is the natural destination. A is
the smallest, most reversible change; discoverability can be raised
later via a dashboard tile (C) in a separate wave.

**Build impact if B is chosen:** Modify sealed `_page-header.tsx` ·
add icon + aria-label + palette token · update Playwright header
regression · requires a separate "sealed chrome amendment"
authorisation beyond the Family Links UI wave.

---

## Decision 5 · Retention policy for `revoked` family-link rows

**Question:** Today `revoked` rows live indefinitely as append-only
history. Do we introduce a retention policy, and if so, what?

**Options:**
  - **A) ⭐ Keep indefinite retention for now (do nothing in this UI wave)** — safety history is forensically valuable · defer the question to a dedicated retention / privacy wave with its own migration.
  - **B) Anonymise after 2 years, hard-delete after 7** — balances privacy with safety-history retention · requires a new migration + background job · not shippable in the UI wave.
  - **C) Hard-delete immediately on revoke** — cleanest privacy stance · but destroys the forensic trail that lets HQ reconstruct coercion patterns.
  - **D) Other: ____________**

**Trade-off:** A revoked family-link row carries a soft-reference to
real identities. Deleting too eagerly (C) erases exactly the evidence
HQ needs when a pressure signal fires later. Deleting on a schedule
(B) is defensible but requires a migration, a scheduled job, and a
privacy-notice update — all of which belong in a separate wave. The
question is real but orthogonal to the UI build; a later retention
wave can land B or C without any UI code change.

**Build impact if B or C is chosen:** The UI wave remains unchanged
either way; however, approving B/C here means also authorising a
separate migration + scheduled-task wave (NOT part of this UI build).

---

## After you answer

Reply with the chosen letters (e.g. `1A, 2A, 3B, 4C, 5A`). The agent will:

- Author the build authorisation request citing your answers
- Request a dedicated Family Links UI build wave with the sealed spec
  plus your answers as the contract
- Confirm no code is written against the spec until that wave is
  explicitly authorised
