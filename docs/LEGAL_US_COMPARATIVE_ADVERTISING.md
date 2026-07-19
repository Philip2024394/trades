# USA Law — Comparative Advertising + Competitor Pricing Online

_Compiled from research-agent scan of Lanham Act jurisprudence, FTC 1979 Policy Statement, and First Amendment commercial-speech doctrine. Not legal advice — verify with a US IP/advertising attorney before public publish._

**Last updated:** 2026-07-18
**Applies to:** `/trade-off/us/compare-platforms/` + `src/data/tradePlatformComparison.us.ts`
**Owner:** Philip
**Review cadence:** Quarterly (USA pricing changes constantly; Lanham Act is fee-shifting so staleness = attorney's-fees exposure)

---

## Regulatory framework — USA

| Regulation | Purpose | Relevant to us |
|---|---|---|
| **Lanham Act §43(a)** — 15 U.S.C. §1125(a) | Federal false-advertising statute; competitor standing | The operative statute. Competitor can sue directly for false or misleading factual claims |
| **Lanham Act §35(a)** — 15 U.S.C. §1117 | Fee-shifting in "exceptional" cases | Prevailing plaintiff can recover attorney's fees — stale pricing tends to qualify |
| **FTC Statement of Policy Regarding Comparative Advertising** (1979) — 16 C.F.R. §14.15 | Explicitly encourages naming competitors | Truthful comparative advertising is "a source of important information to consumers" |
| **FTC Act §5** — 15 U.S.C. §45 | Prohibits "unfair or deceptive acts or practices" | FTC enforcement layer above Lanham Act |
| **First Amendment commercial speech doctrine** | Constitutional protection for truthful commercial speech | Restricts government's ability to ban truthful comparisons |
| **State false advertising laws** (e.g. CA Bus. & Prof. Code §17500, NY Gen Bus. Law §349-350) | State-law parallel to Lanham Act | Broader consumer standing in some states |

---

## What's DEFINITELY allowed

- **Naming competitors** — FTC 1979 Policy Statement affirms this; industry codes prohibiting it are federally preempted.
- **Displaying competitor prices** — protected if truthful, substantiated, current, and not misleading in overall presentation.
- **Using competitor trade marks** — nominative fair use doctrine (Ninth Circuit test): (1) product not readily identifiable without the mark, (2) only so much of the mark as reasonably necessary, (3) nothing suggests sponsorship or endorsement. See *New Kids on the Block v News America Publishing*, 971 F.2d 302 (9th Cir. 1992); *Playboy Enterprises v Welles*, 279 F.3d 796 (9th Cir. 2002).
- **Aggregating public information** — protected as intermediary opinion.
- **Puffery** — subjective, non-falsifiable claims ("the best") are non-actionable. *Pizza Hut v Papa John's*, 227 F.3d 489 (5th Cir. 2000).

## What requires CARE

- **"Cheapest / best / most" as objective claims** — puffery defence collapses if the claim is capable of proof. Second Circuit + Ninth Circuit require substantiation for the whole competitive universe.
- **Implied claims** — courts read the overall impression, not just literal words. *POM Wonderful LLC v Coca-Cola*, 573 U.S. 102 (2014).
- **Feature-tick tables** — must accurately represent competitor capability; can't cherry-pick or omit context.
- **Stale prices** — creates direct §43(a) liability. Prices change; keep dated screenshots.
- **Superlatives ("USA's #1 platform")** — need substantiation across the whole market at the time of claim.
- **Comparisons of dissimilar products** — must be like-for-like or clearly signposted.

## What is NOT allowed

- **Literal falsity** — a factual claim that's demonstrably wrong. Presumption of consumer deception; no need to prove actual deception. *United Industries v Clorox*, 140 F.3d 1175 (8th Cir. 1998).
- **Misleading statements** — even if literally true, if the net impression deceives a reasonable consumer. *POM Wonderful*.
- **Confusing consumers into thinking you ARE the competitor** — traditional Lanham Act §43(a)(1)(A) trademark infringement.
- **Denigrating a competitor's product with false claims** — Lanham Act §43(a)(1)(B) false-advertising branch.
- **Bait-and-switch pricing** — FTC enforcement matter under §5.
- **Deceptive endorsement / affiliation implication** — Lanham Act §43(a)(1)(A).

## Landmark cases

| Case | Court | Lesson |
|---|---|---|
| *POM Wonderful LLC v Coca-Cola*, 573 U.S. 102 | S.Ct. 2014 | Lanham Act reaches even FDA-regulated categories. Overall impression matters. |
| *Pizza Hut v Papa John's*, 227 F.3d 489 | 5th Cir. 2000 | "Better ingredients, better pizza" was puffery — non-actionable. Threshold for objective vs subjective claim. |
| *United Industries v Clorox*, 140 F.3d 1175 | 8th Cir. 1998 | Literal falsity creates presumption of consumer deception — no proof of actual deception required. |
| *New Kids on the Block v News America*, 971 F.2d 302 | 9th Cir. 1992 | Nominative fair use three-factor test — bedrock defence for using competitor TM. |
| *Playboy Enterprises v Welles*, 279 F.3d 796 | 9th Cir. 2002 | Nominative fair use extended to metatags + banner ads. |
| *Central Hudson Gas v Public Service Comm'n*, 447 U.S. 557 | S.Ct. 1980 | First Amendment intermediate-scrutiny test for commercial speech. |
| *Sorrell v IMS Health*, 564 U.S. 552 | S.Ct. 2011 | Strengthened commercial-speech doctrine — content-based restrictions get heightened scrutiny. |
| *Groupe SEB USA v Euro-Pro Operating*, 774 F.3d 192 | 3rd Cir. 2014 | Comparative claim about steam-iron output — literal falsity found; product recalled. |

## Nominative fair use — Ninth Circuit test in detail

To defensibly use a competitor's trade mark in comparative advertising, all three must be true:

1. **Necessity** — the product/service is not readily identifiable without the mark. (Yes for us — we can't compare against "Angi" without calling them Angi.)
2. **Minimum use** — you use only so much of the mark as reasonably necessary. (Text only, no logos, no visual mimicry.)
3. **No sponsorship implication** — nothing suggests endorsement, affiliation, or sponsorship by the mark holder. (Our chart explicitly disclaims this in the TM footer.)

Our USA chart passes all three.

## Post-DMCCA (UK) equivalent risk in USA

The USA does not have a direct equivalent to the UK's DMCCA 2024 10%-turnover fines. But:

- **FTC has similar direct-enforcement powers under FTC Act §5** — civil penalties up to ~$50,120 per violation (2024 CPI-adjusted).
- **State AG enforcement** — California, NY, Texas each have consumer-protection statutes with private and government standing.
- **Class actions** — under Rule 23 + state consumer laws, aggregate damages can exceed FTC penalties.
- **Lanham Act §35(a)** — attorney's fees in exceptional cases + treble damages available.

Practical exposure is comparable to the UK regime, just distributed across more forums.

## What our USA chart does right

Already applied on `/trade-off/us/compare-platforms/`:
- Text names only, no logos, no visual mimicry (nominative fair use factor 2)
- 16 objective boolean feature dimensions
- "As at [Month Year]" stamp prominently bolded
- Methodology anchor + link in-chart (verifiability)
- Honest disclosure — where competitors beat us (3 areas listed)
- Rescoped superlatives — "of the N platforms we surveyed"
- Trade mark attribution footer citing *New Kids on the Block* + *Playboy v Welles*
- 14-day correction email — `admin@thenetworkers.app`
- Commercial intent disclosed
- Regulatory framing citing Lanham Act §43(a), FTC 1979 Policy Statement, First Amendment doctrine

## Before public publish — checklist

- [ ] **Evidence file per competitor** — screenshot each competitor's public pricing page + save dated to `docs/comparison-evidence/us/{competitor}/`. Required for Lanham Act §43(a) substantiation defence.
- [ ] **US IP/advertising attorney review** — a US-qualified attorney should review the exact wording. Different states have different consumer-protection statutes; California and New York are the highest-risk forums.
- [ ] **Quarterly re-verification** — Angi lead pricing is dynamic; Thumbtack varies by trade + zip; TaskRabbit fees change. Set 90-day reminder.
- [ ] **Correction mailbox monitored** — `admin@thenetworkers.app` must be watched. 14-day SLA committed publicly.
- [ ] **DMCA safe-harbor registration** — if we host any user-generated content that references competitors, register a DMCA agent (17 U.S.C. §512(c)(2)) at $6.
- [ ] **State-level check** — California CLRA (Cal. Civ. Code §1750 et seq.), New York GBL §349, Massachusetts 93A each have private-attorney-general provisions.

## Sources (starting list)

- [Lanham Act §43(a) — 15 U.S.C. §1125](https://www.law.cornell.edu/uscode/text/15/1125)
- [Lanham Act §35(a) — 15 U.S.C. §1117](https://www.law.cornell.edu/uscode/text/15/1117)
- [FTC 1979 Comparative Advertising Policy Statement](https://www.ftc.gov/legal-library/browse/statements/statement-policy-regarding-comparative-advertising)
- [POM Wonderful v Coca-Cola (2014)](https://supreme.justia.com/cases/federal/us/573/102/)
- [New Kids on the Block v News America (1992)](https://law.justia.com/cases/federal/appellate-courts/F2/971/302/234020/)
- [Playboy v Welles (2002)](https://law.justia.com/cases/federal/appellate-courts/F3/279/796/519655/)
- [Central Hudson v Public Service Comm'n (1980)](https://supreme.justia.com/cases/federal/us/447/557/)
- [FTC Act §5 civil penalty rates 2024](https://www.federalregister.gov/documents/2024/01/10/2024-00381/adjustments-to-civil-penalty-amounts)
