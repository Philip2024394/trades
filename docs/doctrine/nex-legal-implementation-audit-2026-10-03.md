# NEX Legal ↔ Implementation Audit · 2026-10-03

**Status:** Closed. Documentation-only record. Governs the freeze state of Terms of Use v1.2 and Privacy Policy v1.2.

**Not a code change.** This file records that an audit was performed. It is not an authorization to modify product code, migrations, or the legal documents themselves.

---

## Baseline

| Artefact | Commit | Scope |
|---|---|---|
| Terms of Use v1.2 | `0113207a` | 22 numbered sections; honest about Vault not being E2E |
| Privacy Policy v1.2 | `53901843` | 21 numbered sections; explicit "Implemented today" vs "Planned architecture" split |
| Implementation baseline | `main` HEAD at audit time (post-`53901843`) | Full repository state, including Vault Stages 1-6 at `4d527967` |

---

## Result

```
24 PASS
 4 WARNING
 0 MISMATCH
 3 UNVERIFIED
```

**Conclusion:** No direct contradiction was identified between the legal documents and the deployed implementation examined in this audit.

Warnings and unverified items are retained for external legal review and/or future implementation verification. They do not constitute authorization to modify product code or legal documents.

**Vault E2E remains planned architecture and is not represented as implemented.**

**The six-digit Vault PIN remains a prototype and is not represented as a production cryptographic security boundary.**

---

## Finding categories

### PASS (24 items · summary only)

Every explicit technical claim in Terms v1.2 and Privacy Policy v1.2 that could be traced to code traced correctly. Verified in this pass:

- peer text E2E (`nacl.box`, Bridge 76+) · `peer-message-service.ts`
- peer personal media envelope encryption (`nacl.secretbox` + per-recipient key wrap, Bridge 81) · `crypto/attachment-envelope.ts`
- commerce media bypass is deliberate · same file
- WebRTC P2P for voice (Bridge 68) and video (Bridge 69) · `calls/peer-call.ts`
- business chat is not claimed E2E · `conversation-service.ts` has zero crypto references
- Vault entry metadata is observation-free (migration 128)
- Vault RLS owner-scoped on both metadata table and `storage.objects` policies (migrations 128 + 129)
- `nex-vault-files` bucket is private (`public = false`)
- signed-URL default TTL = 60 s
- PIN entry is prototype-labelled in code
- Supabase SSR cookie, Bridge 99 `nex_session` cookie, service worker, cart local storage
- Vercel Analytics + Speed Insights mounted
- device-environment signal scope doctrinally bounded (5-signal whitelist, hashed, risk-only)
- Resend used for account email; Stripe used as payment provider; VAPID web-push used for push
- `nex_report` table exists; observability modules exist
- Vault deletion today is row + object deletion (policy correctly labels cryptographic erasure as planned)
- "operational authority" wording is non-contradictory with "cannot access" claims
- no "unbreakable" / "military-grade" / "nobody can see" / "NSA-proof" claims

### WARNING (4 items · retained for lawyer review)

**W1 · Named third-party processors are missing from Privacy §12.** Policy names Supabase and Vercel but not Stripe, Resend, Apple APNs, Google FCM. GDPR Art 30 / LGPD / Indonesia PDP typically expect named sub-processors. Factually true as written; under-specific for jurisdictions with naming requirements.

**W2 · "Vault security is separate from ordinary NEX account access" (Terms §6).** In today's architecture Vault uses the same Supabase Auth session as the rest of the signed-in surface, plus the mock PIN. The adjacent sentence hedges correctly ("Until a particular security mechanism is expressly identified as active, users should not assume that it has been implemented") but the "separate" wording precedes that hedge.

**W3 · Legacy plaintext peer-message rows (Privacy §4).** The ciphertext-only statement applies to Bridge 76+ encrypted rows; pre-Bridge-76 legacy rows (where `encrypted = false`) can still be read by the server. §5 scopes correctly to "Bridges 76+"; §4 does not.

**W4 · Vercel Analytics data categories not scoped in Privacy §10.** Policy says "aggregate and operational rather than individually targeted" — true for intent but exact categories collected by `@vercel/analytics` + `@vercel/speed-insights` are governed by Vercel's own terms and not inspectable from the repo.

### UNVERIFIED (3 items · deliberately not guessed)

**U1 · Trust Scan statements (Privacy §9).** Doctrinally consistent with the sealed `nex-trust-scan` 2026-10-01 doctrine. Needs a pointed implementation audit of `src/app/nex-native/_trust-scan/` surfaces if/when Trust becomes a launch priority.

**U2 · Infrastructure regions (Privacy §17).** True in principle (Supabase + Vercel are multi-region) but the policy does not state the actual region NEX's data is pinned to. Answerable from the Supabase / Vercel dashboard, not from the repo.

**U3 · Bucket-level public/private disclosure.** The repo has public buckets (`nex-chat-theme-hero`, theme-sticker, etc.) and private buckets (`nex-vault-files`). The Privacy Policy does not currently distinguish bucket-level privacy. Legitimate legal-review question, especially given NEX has multiple storage classes.

---

## Freeze policy

**Terms v1.2 + Privacy Policy v1.2 = implementation-aligned internal legal drafts, frozen pending external legal review.**

The next changes to Terms or Privacy Policy should happen **only** if one of the following is true:

1. **a lawyer identifies a required amendment**;
2. **the implementation changes materially** (e.g. a new category of data is collected or stored);
3. **a new processor is actually introduced** into the codebase;
4. **Vault Phase A genuinely ships** (client-side E2E for Vault with keys NEX never holds);
5. **another factual mismatch is discovered** by a subsequent audit.

**Review findings W1–W4 are not implementation requirements.** They are notes for the external legal reviewer. Do not amend the documents merely to close a warning; wait for lawyer review to prescribe the exact wording.

**The three UNVERIFIED items are not to be guessed.** U1 waits for a Trust Scan implementation audit. U2 waits for a confirmed region configuration. U3 waits for the lawyer-review process.

---

## Governance significance

This audit closes the chain:

```
Doctrine (vault-build-plan 2026-10-03)
   ↓
Implementation (Vault Stages 1-6 · 4d527967)
   ↓
Tests (279/279 proofs reported pre-commit)
   ↓
Legal wording (Terms v1.2 + Privacy Policy v1.2)
   ↓
Independent consistency audit (this record)
```

Remaining uncertainty is explicitly labelled (W1–W4, U1–U3) rather than hidden.

---

## Change log

- 2026-10-03 · initial record · freeze declared on Terms v1.2 and Privacy Policy v1.2 pending external legal review. No prior audit record to supersede.
