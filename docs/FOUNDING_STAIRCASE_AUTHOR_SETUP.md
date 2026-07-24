# Founding Staircase Brain Author · Setup Runbook

**Self-serve runbook · 2026-07-23**
**Purpose:** if you (Philip) choose to be the founding Author for the Staircase Brain, this document walks you through the setup end-to-end. Every step is one you perform yourself — this runbook does not pre-fill your personal information or flip any switches on your behalf.

**Important:** being a Trade Brain Author is a REAL role with REAL obligations (quarterly review · attribution on merchant-facing surfaces · warranties in §7 of the Author Contract). Read the Recruitment Package §3 credentials requirement + §5 compensation structure + §9 commercial expectations before committing.

---

## Section 1 · Credentials self-check

Per `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` §3, non-negotiable qualifications:

- [ ] Minimum 15 years hands-on staircase or joinery experience
- [ ] Verified certification from a recognised body (BWF Stair Scheme member · Guild of Master Craftsmen · Federation of Master Builders · CITB card · equivalent)
- [ ] Experience across multiple regional contexts (worked in ≥2 UK regions)
- [ ] Track record of training apprentices, writing trade content, or authoritative teaching
- [ ] Willingness to be named publicly on every merchant-facing Brain surface with your credentials

If you don't clear all five, that's not a stop sign — but the arms-length External Author path is a better fit. External sourcing per Recruitment Package §3 sourcing channels.

Being CEO of Nex does not by itself qualify you. The Brain's credibility depends on the Author's trade credentials, not their platform ownership. If you are a certified master staircase manufacturer / master joiner with ≥15 years' bench experience AND you happen to be Philip, that's fine — but the qualification is separate from the role.

**If you clear the credentials:** proceed to §2.
**If not:** stop this runbook and route recruitment via Program Lead per Recruitment Package §6.

---

## Section 2 · Fill the Author Contract Template

Use `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md` as the source. Every `«PLACEHOLDER»` in the template is a field you fill in. Rename your working copy `TRADE_BRAIN_AUTHOR_CONTRACT_PHILIP_STAIRCASE_V1.md` so it's clear this is a live instantiated contract, not the template.

Fields you fill in yourself:
- Parties (your legal name, address, trade, primary certification + number)
- Effective date
- Contract term (default 2 years renewable)
- V1 authoring honorarium amount (£8,000-£15,000 range per Recruitment §5 — decide with CTO/Product what your rate is)
- Quarterly maintenance retainer amount (£500-£1,000 range)
- Delivery timeline (default 15 weeks per Staircase Brain Spec §13 — negotiate with Program Lead)
- Bank details for payment
- IR35 posture confirmation (if UK — separate limited company vs sole trader vs employed status affects clauses 3 + 12)

Fields you do NOT fill in yourself:
- Every clause marked 🛑 in the template — those need qualified UK employment/IP Legal Counsel to review the wording before signature
- Nex signatory (CTO or Product Lead signs on Nex side)
- Governing law and dispute resolution forum (Legal decides)

Founder-specific note: because you are also Nex CEO, this contract creates a related-party transaction. Legal Counsel MUST advise on whether:
- Board approval is needed on the Nex side (very likely yes)
- IR35 posture is affected by the related-party nature
- Attribution disclosure is required ("Author is also Nex founder") on merchant-facing surface for honesty per ADR-0020

Do not skip Legal Counsel review. The template's Legal Review Checklist at the end lists every clause requiring signoff.

---

## Section 3 · Legal Counsel review

Send `TRADE_BRAIN_AUTHOR_CONTRACT_PHILIP_STAIRCASE_V1.md` to Legal Counsel with these specific asks:

- [ ] Every 🛑 clause resolved with enforceable wording
- [ ] Related-party (Author = CEO) implications flagged and addressed
- [ ] Board approval requirement confirmed on Nex side
- [ ] Attribution requirement clarified (should merchant-facing Brain surface disclose the founder relationship?)
- [ ] IR35 posture aligned with your other engagements with Nex

Do not sign until every checkbox is Yes. This is a contract you personally sign — the wrong wording binds you personally to warranties + liability.

---

## Section 4 · Merchant Advisory Panel · founder-specific consideration

Per `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` §5, the Panel votes on every V1 Brain publish. For a founder-Author, the Panel is the primary independent check that the Brain content is technically sound rather than owner-authorised.

You should specifically:
- Ensure the Panel is seated BEFORE your Staircase Brain reaches Meeting 2 signoff
- Not vote on your own Brain (Charter §7 conflict-of-interest recusal)
- Publish the "Author is also Nex founder" disclosure on the merchant-facing attribution line (per Legal Counsel guidance in §3)

If the Panel is not yet seated when your Brain is ready, the Brain stays at `author_review` status until the Panel is seated and can meet.

---

## Section 5 · Environment configuration

You perform each of these actions yourself in the deployment environment. This runbook does not touch any env var.

Required env vars (production or staging where you want to work):

```bash
# Studio flag — turn ON when you're ready to sign in
NEX_AUTHOR_STUDIO_ENABLED=1

# Allowlist — put YOUR email (matching what you'll use as author_id)
NEX_AUTHOR_ALLOWLIST=phillipofarrell@gmail.com

# Cookie signing secret (min 32 chars · high-entropy random)
NEX_AUTHOR_COOKIE_SECRET=<generate 48+ random hex chars>

# Invite token signing secret (min 32 chars · high-entropy random)
NEX_AUTHOR_INVITE_SECRET=<generate a DIFFERENT 48+ random hex chars>
```

Generate the secrets locally (not in this repo):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Rotate secrets if either is ever exposed. Rotating COOKIE_SECRET invalidates all existing sessions (you sign in again). Rotating INVITE_SECRET invalidates unused invite tokens.

---

## Section 6 · Issue your first invite token + sign in

With env vars set, generate your invite token (server-side, one-off):

```typescript
// Run once in a server-side context (e.g. a Node REPL against your
// deployment · or a small admin script).
import { issueInviteToken } from "@/lib/nex/brains/_studio/_session";
const token = issueInviteToken("phillipofarrell@gmail.com");
console.log(token);
```

The token is time-limited (7 days default). Copy it — you paste it once.

Visit `/authors` in a browser signed out. You'll see the invite-token form. Paste the token. On submit, `tn_author_sid` cookie is set (30-day TTL) and you're routed to `/authors/dashboard`.

---

## Section 7 · Register the Staircase Brain

If the `brain_content_v0.sql` migration has not been applied yet, the Studio uses filesystem-fallback and no DB registration is needed — it will detect your drafts automatically.

If the migration IS applied, insert a Brain registry row so the dashboard sees your Brain:

```sql
INSERT INTO public.hammerex_nex_brains (
  slug, name, category, version, status,
  primary_author_id, primary_author_name, primary_author_creds,
  supported_countries
) VALUES (
  'staircase',
  'Staircase Brain',
  'trade',
  '0.1.0',
  'draft',
  'phillipofarrell@gmail.com',
  '«YOUR LEGAL NAME»',
  '«YOUR CERTIFICATION + NUMBER»',
  ARRAY['UK']
);
```

Replace the placeholders with your actual name + certification. Verify by refreshing `/authors/dashboard` — the Staircase Brain should appear with `Extract from notes` as the primary action.

---

## Section 8 · Your first extraction session

1. Navigate to `/authors/brains/staircase/extract`
2. Paste a single subject's worth of your staircase knowledge (500-2000 words works well for a first session)
3. Optionally pick a Module hint (e.g. Craft if the paste is technique-heavy, Regulations if compliance-heavy)
4. Click Extract candidates
5. Review each candidate:
   - Green candidates have a `source_span` from your paste — you can Accept if the wording is right
   - Amber candidates are flagged `needs source` — you must add a citation before Accept becomes available
   - Reject anything that doesn't reflect your real experience (LLMs will occasionally generalise beyond what you actually wrote)
6. Accepted candidates immediately appear in the corresponding module editor tab at `/authors/brains/staircase/edit`
7. Move to `/authors/brains/staircase/edit` to polish, then move to the Manifest tab to add your name + credentials to the Brain identity

Save frequently (each editor's Save button writes to `hammerex_nex_brain_content` when the table exists, filesystem otherwise).

---

## Section 9 · When to submit for Panel review

Do NOT submit for Panel review until:

- Advisory Panel is seated (Charter §Approval signoffs complete + Panel members inducted)
- You have populated all 6 V1 modules with enough content that the Panel has something material to review (rough guide: ≥5 facts per module + ≥3 regulations + ≥5 defects + at least one workflow playbook + at least one pricing rule per material family)
- You have run "Run boot-audit preview" successfully — all 6 V1 modules pass Zod validation
- Legal Counsel has finalised your Contract (§3 above)

When ready, click "Submit for Panel review" in the Brain editor. Brain status flips `draft` → `author_review`. Panel takes it from there per Charter §4 Meeting 1 (Halfway Review) at ~Week 8, Meeting 2 (Signoff) at ~Week 14.

---

## Section 10 · What you are and are not

**You ARE:**
- The Author of record for the Staircase Brain V1
- Personally attributed on every merchant-facing Brain surface
- Responsible for the technical accuracy of every fact you Accept
- Bound by the Author Contract §7 warranties for content you author
- Paid the honorarium per contract (this is a real payment — you record it appropriately for tax + IR35 purposes)

**You are NOT:**
- The Merchant Advisory Panel (they check your work · you don't check theirs)
- The Legal Counsel who signs off the contract wording
- The CTO who authorises the flag flip and migration applies
- Exempt from Panel signoff because you are also CEO — the Panel is your primary independent check

---

## Cross-references

- `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` — role scope, compensation, expectations
- `TRADE_BRAIN_AUTHOR_CONTRACT_TEMPLATE_V0.md` — contract template to instantiate
- `MERCHANT_ADVISORY_PANEL_CHARTER_V1.md` — Panel governance
- `BRAIN_CONTENT_PRODUCTION_PIPELINE_V1.md` — the 9-step pipeline you're walking
- `PHASE_0_UNLOCK_CONDITIONS_V1.md` — where this fits in the 7-gate unlock model
- Author Studio code · `src/lib/nex/brains/_studio/` + `src/app/authors/` + `src/apps/author-studio/`
- Extraction pipeline code · `src/lib/nex/brains/_studio/_extraction/`

---

**End of Founding Staircase Brain Author Setup Runbook.**

*You own every action in this document. Nex code provides the tooling; the credentials, the contract wording, the environment variables, and the Brain content are yours.*
