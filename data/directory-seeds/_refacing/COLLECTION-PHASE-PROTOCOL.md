# NEX UK Staircase Refacing · Collection Phase Protocol

**Authored by:** Philip 2026-08-13
**Trigger to activate:** the manual Collector acceptance test has passed end-to-end.
**Executor:** NEX workers researching public internet sources, entering verified data via `/admin/collector/staircase_refacing`.

> This document is the operational rulebook for the real UK-wide staircase refacing trade collection. It is intentionally durable — future sessions must open THIS file before starting a collection batch, not re-derive the rules.

## 1. Main objective

Find genuine UK businesses that work on **existing** staircases:
staircase refacing · refurbishment · renovation · covering · cladding · overcladding · tread/riser replacement · existing staircase upgrades · restoration · makeover · handrail/baserail replacement · baluster/spindle replacement · newel replacement · glass or stainless-steel balustrade upgrades · related existing-staircase joinery.

**No fixed stopping number.** Continue until UK geographic coverage is genuinely substantially complete and additional searches produce mostly duplicates or non-qualifying businesses.

## 2. Where workers research

Google · Google Maps · company websites · contact pages · Checkatrade · Yell · Rated People · MyBuilder · Houzz · other legitimate UK trade directories. Always verify against the company's own website where possible.

## 3. Batch cadence

- **Target 20–30 companies per session.**
- **Save continuously** — never wait until 100+ are researched. Protects against lost work; keeps duplicate detection meaningful.
- If a session is producing difficult research, smaller batches are acceptable. **Quality over quantity.**

## 4. Geographic sweep order

Start with the largest/highest-density markets, then radiate outward.

**England (high-density first):** London · Manchester/GM · Birmingham/West Midlands · Leeds/West Yorks · Liverpool/Merseyside · Sheffield/South Yorks · Nottingham · Leicester · Bristol · Newcastle/NE · Derby · Coventry · Wolverhampton · Stoke · Bradford · York · Hull · Cambridge · Oxford · Reading · Milton Keynes · Northampton · Norwich · Ipswich · Colchester · Chelmsford · Southend · Brighton · Crawley · Guildford · Woking · Southampton · Portsmouth · Bournemouth · Exeter · Plymouth · Bath · Gloucester · Cheltenham · Swindon.

**Wales:** Cardiff · Swansea · Newport · Wrexham · surrounding towns.

**Scotland:** Glasgow · Edinburgh · Aberdeen · Dundee · Perth · Stirling · surrounding towns.

**Northern Ireland:** Belfast · Derry/Londonderry · Lisburn · Newry · surrounding towns.

**After each major city:** expand into surrounding towns and the wider county. e.g. Manchester → Stockport · Bolton · Wigan · Oldham · Rochdale · Bury · Warrington · etc.

**Pattern:** city → surrounding towns → county → wider region.

## 5. Search terms (use many variations · never rely on one)

`staircase refurbishment` · `staircase renovation` · `staircase refacing` · `stair refacing` · `stair refurbishment` · `stair renovation` · `stair covering` · `stair cladding` · `staircase cladding` · `stair tread replacement` · `stair riser replacement` · `staircase makeover` · `existing staircase renovation` · `existing staircase refurbishment` · `staircase refurbishment company` · `staircase renovation company` · `staircase carpenter` · `stair refurbishment joiner` · same terms with `[CITY]` and `[COUNTY]` appended.

## 6. Qualification (evidence-based · never inferred)

- **A+** — clear evidence of working on EXISTING staircases through refacing/refurbishment/renovation/covering/cladding/replacement components.
- **A** — strong existing-staircase renovation/refurbishment evidence.
- **B** — likely relevant staircase trade but existing-staircase/refacing evidence needs more verification.
- **C** — primarily new staircase/manufacturing work (not our target).
- **excluded** — not relevant.

A company that only manufactures + installs new staircases is not A/A+. If uncertain, `B` or leave for review. **Never guess.**

## 7. Public business email — priority field

Actively hunt for `info@` · `enquiries@` · `sales@` · `office@` · `contact@` or any clearly-published business email. Check: website · contact page · about page · footer · Google business info · legitimate directory profile · public business social/profile.

## 8. When the fetch tool masks the email

**Never invent.** If the site clearly displays an email to a human but the fetch tool masks/hides/omits it, or renders it as an image or `mailto:` only:

- `email = null` (or leave the raw string if partial · but don't guess)
- `email_status = "needs_manual_verification"` (🟡 in the Collector form + dashboard)
- Record the source URL in `email_source_url`
- Optional: worker note `email_observed_but_not_extractable` for context
- The dashboard's Email priority queue surfaces every 🟡 record for a later manual pass

If a second legitimate source (directory profile) surfaces the email verbatim, use that source and switch to `email_status = "verified"` (🟢).

## 9. Never guess emails

Do NOT auto-generate `info@example.co.uk` from a `example.co.uk` domain. Only record an email when there is evidence it is publicly used by the business.

## 10. Required fields per record

Company: name · trading name · website
Location: address · city · county · postcode · service area
Contact: public email · email source · email verification status · phone · phone source
Reputation: Google rating · Google review count · Google source · date checked
Services (yes/no/unknown): refacing · refurbishment · renovation · covering · cladding · treads · risers · handrails · baserails · newels · balusters/spindles · glass · stainless steel · sanding · staining · painting · restoration · repair
Evidence: URL · type · summary · checked date

## 11. Google ratings

Capture rating + review count whenever genuinely available. Never invent. Unavailable → `null`.

## 12. Duplicates

Always let the Collector duplicate check run. Google + Checkatrade + own website for the same company = ONE NEX record (with multiple sources), not three.

## 13. When a fetch fails

Do NOT stop the whole session. Continue to the next company · mark the failed source · record the company if enough is verified elsewhere · return to failed sources later. **A single broken website never stops a city sweep.**

## 14. When Google/directory data is incomplete

Don't discard a good company because one source lacks an email. Try the company's own website. Still nothing → save with `email = null`, keep moving. **Honest > artificially complete.**

## 15. Email priority queue (dashboard states · tri-state field `email_status`)

- 🟢 **verified** — verified public email confirmed on the source
- 🟡 **needs_manual_verification** — email exists / appears to exist on the source but couldn't be reliably extracted (fetch masked · JS-rendered · image · mailto-only) OR present but unconfirmed
- 🔴 **not_found** — no public email located after search

Enables later remediation passes. Dashboard shows counts + a queue for 🟡 and 🔴 records so workers know which to revisit.

## 16. Batch report (after every session)

- Companies researched · added · duplicates · excluded
- Qualification counts A+/A/B/C
- Public emails verified · needing manual verification · none found
- Google ratings found
- Cities · counties covered
- Failed sources
- Companies flagged for review

**Never inflate the numbers.**

## 17. Do NOT automatically contact businesses

Collection ≠ marketing. Collect · verify · list · prepare for claim. No automated marketing email just because an email was collected. Only the existing NEX approved communication workflow may reach out.

## 18. Stopping condition

**No arbitrary cap.** Stop only when: planned UK geographic coverage is genuinely substantially complete · major towns and surrounding areas have been swept · multiple search term variations tried · additional research is mostly returning duplicates or non-qualified businesses.

## 19. Final target

**The UK Staircase Refacing Trade Database** — genuine businesses that work on existing staircases. Each record ideally carries: Company · City · County · Address · Phone · Public Business Email · Website · Google Reviews · Refacing Evidence · Capabilities · Qualification · Sources · Claim Status. Grows over time. Never fabricated.

---

## Ready-to-run session checklist

Before starting a collection session:

1. Manual acceptance test has passed ✅ (or pending — check with Philip)
2. Category `staircase_refacing` is enabled in the registry ✅
3. Dev server running · admin session active
4. Batch target: 20–30 verified companies
5. City for this session decided (start with London / GM / Birmingham)
6. Search-term variation list ready (§5)

During the session:

- For each candidate → search company website → verify capabilities → verify email → save via Collector → note any duplicates → move on
- Failed fetch → flag + move on
- Masked email → `email = null` + note + move on
- Never fabricate

After the session:

- Post the batch report (§16 fields)
- Update dashboard counts
- Note failed sources for retry queue
