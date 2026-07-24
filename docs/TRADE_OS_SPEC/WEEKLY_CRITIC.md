# Trade OS · Weekly Critic Board

Every Monday, before writing any new code, run this review. Fill in
the scores, cite evidence, ship a punch list. **The critic is not
allowed to defend the implementation.**

The role is Adobe internal review board. The bar is production.

## Instructions to Claude

- Score each axis 0-100. Anything under 90 → explain why + name the top
  1-3 remediations.
- Every score must reference specific files, routes, or measurable
  outcomes. No adjectives without evidence.
- Reject the temptation to "grade on effort" — the merchant doesn't
  care how hard something was.
- Compare against the reference standards named next to each axis, not
  against last week's Trade OS.
- If a score improved from last week, explain what changed. If it
  regressed, flag it as urgent.

## 9-axis scoring rubric

| # | Axis | Reference standard | This week | Notes |
|---|---|---|---|---|
| 1 | **UI** — visual quality, hierarchy, restraint | Linear · Stripe Dashboard · Notion | /100 | |
| 2 | **UX** — task efficiency, obvious next step, forgiveness | Figma onboarding · Apple Notes · Cash App | /100 | |
| 3 | **Accessibility** — WCAG 2.2 AA, keyboard, screen reader, contrast, motion | GOV.UK · Shopify · Salesforce Lightning | /100 | |
| 4 | **Speed** — TTFB, LCP, generation p95, cold start | Vercel Speed Insights defaults; van wrap p95 target < 45s | /100 | |
| 5 | **Merchant happiness** — would a 55-year-old builder ship without help? | Zero-training test | /100 | |
| 6 | **AI quality** — Critic pass rate, hallucination rate, prompt reliability | > 92 avg critic score; < 3% hallucination on knowledge | /100 | |
| 7 | **Business value** — does this help win, keep, or price work? | 5-test filter from CLAUDE.md rules 3-4 | /100 | |
| 8 | **Revenue opportunities** — unlocked, chargeable, retained | Every paid feature clears Stripe margin (ADR-0010) | /100 | |
| 9 | **Simplicity** — count of clicks, count of concepts on-screen, count of jargon words | 3-second rule | /100 | |

### Weighted overall

Weights: UI 10 · UX 15 · Accessibility 10 · Speed 10 · Merchant happiness 20 · AI quality 15 · Business value 10 · Revenue 5 · Simplicity 5 = 100

## Fixed questions the critic asks every week

- What did we ship this week that a merchant actually touched?
- Which Studio still fails at 55-year-old builder threshold?
- Which surface has the highest bounce point? (Requires analytics)
- Which Nex intents keep falling through to "unknown"? (Grep chat logs)
- Which knowledge queries returned zero hits? (Grep retrieveKnowledge logs)
- What's the average critic score this week vs last?
- What's the average generation cost per Studio? What's the margin?
- Which merchant asked for a feature we don't have?

## Standing punch list template

```
Week of YYYY-MM-DD

Scores
- UI              /100 · notes
- UX              /100 · notes
- Accessibility   /100 · notes
- Speed           /100 · notes
- Merchant        /100 · notes
- AI quality      /100 · notes
- Business value  /100 · notes
- Revenue         /100 · notes
- Simplicity      /100 · notes
Overall (weighted): /100

Delta vs last week: +/-N

Top 3 remediations (ranked by leverage):
1.
2.
3.

New unknown intents Nex missed:
-

Knowledge gaps (zero-hit queries):
-

Merchant requests we can't yet fulfil:
-
```

## Adjacent review docs

- `HOW_TO_ADD_A_STUDIO.md` — extensibility spec
- `ONBOARDING.md` — day-one engineer kit
- `MERCHANT_DEMO_SCRIPT.md` — the sales-facing walkthrough
- `PLATFORM_ANALYSIS_2026_07_19.md` — strategic snapshot

## Rule for Claude

Do not tell me things are ready. Show me evidence. If evidence doesn't
exist yet, say so and propose how to gather it. The point of a weekly
critic is to prevent Trade OS from drifting from "one shot, no lies,
keep the word."
