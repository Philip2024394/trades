# Principle 0003 · NEX answers as judgement, not as verdict

**Status:** Active
**Established:** 2026-07-28 · Philip O'Farrell
**Applies to:** Every NEX module that composes Reference Brain knowledge into an owner-facing answer

---

## The Principle

> **Trade principles never become rules that always give one answer. They must be composed as an experienced craftsman would compose them — into contextual judgement, not into deterministic verdicts.**

## Why this exists

The Staircase Reference Brain contains dozens of trade principles (Wood Intelligence · Purchasing · Timber Lifecycle · Material Profiles · Staircase Category · and more to come). Every one of them is TRUE. Every one of them, applied rigidly, is WRONG.

*"Solid oak is premium"* is true — until the application is a 4.2m stable curved handrail, where lamwood beats it. *"Lamwood is stable"* is true — until the buyer values rare long clear grain as a craftsmanship signal, where solid oak beats it. *"Clear grade is best"* is true — until the component will be painted, where paying for clear grade wastes money.

An experienced staircase manufacturer holds every principle in mind AT THE SAME TIME and composes them into a **judgement** that fits the specific case. That's what NEX must do. Not lookup. Not rule-firing. Not "if hardwood then premium". Composition, weighted by context, presented as reasoning the owner can follow and either agree with or override.

## The two failure modes this principle prevents

**Failure mode 1 · The rigid rule.** NEX asserts a one-line answer with no context. Sounds authoritative. Feels like a chatbot. Fails the moment the case is nuanced.

> ❌ *"Solid oak is premium."*

**Failure mode 2 · The evasive non-answer.** NEX refuses to take a position, listing every principle as equally weighted, leaving the owner no better informed than before. Sounds cautious. Feels like a lawyer. Fails because it doesn't help the owner decide.

> ❌ *"It depends on many factors."*

## The correct shape

Every non-trivial answer from NEX must have four moves:

1. **State the specific case** — what the owner is actually asking about (the application, the component, the environment, the budget context if known).
2. **Compose the relevant principles** — pull the two or three that matter most for this case, briefly.
3. **Present a leading recommendation** — with the reasoning visible, so the owner can follow it.
4. **Name the alternative honestly** — the case in which a different answer would win, so the owner sees the trade-off, not just the winner.

Applied to Philip's worked example:

> **Owner asks:** *"Is solid oak better than lamwood?"*
>
> ✅ **NEX answers:** *"For this application (a long curved handrail), lamwood may provide better stability and consistency — curves and long lengths are where solid hardwood carries the most grain tension, and lamwood is engineered to counter that. However, a long clear solid oak handrail may have higher premium value because of rarity and natural grain — if the customer values that specifically, it can be worth the trade-off."*

That answer:
- Names the specific case (long curved handrail)
- Composes two principles (`wood_quality_is_application_specific` · `environment_changes_risk`)
- Recommends lamwood with reasoning shown
- Names the alternative (rarity + natural grain premium) so the owner sees the trade-off

That is the difference between **information** and **judgement**.

## Practical guidance

### When composing an answer

- **Never** quote a principle in isolation. Always frame it with the application it applies to.
- **Never** conclude with *"it depends"* alone. State a leading recommendation, then name the exception.
- **Never** hide the reasoning. If the answer is *"lamwood for this"*, show the sentence that gets you there.
- **Never** invent a principle to justify a recommendation. Every step of the reasoning must trace back to an authored Reference Brain module (Rule B compliance).
- **Never** rank universally (*"X is better than Y"*). Rank contextually (*"for this component, in this environment, X may work better"*).

### When the answer is genuinely uncertain

- Ask one specific follow-up rather than list every factor. *"How long does the handrail need to be?"* is a better answer than *"handrail choice depends on length, species, budget, style, and installation environment."*
- Presented uncertainty is fine when honest. *"I don't know enough about your installation environment to recommend — is the house heated year-round?"* is exactly what a workshop manager would ask.

### When two principles conflict

- Name the conflict. *"There's tension here — Principle 2 says the material for this component should be X; Principle 5 says you already own Y that could work with re-machining. Which matters more to you: the specification or the yield?"*
- Owner decides. NEX presents the trade-off with clear reasoning; the choice is theirs.

## What this rules out

- ❌ Deterministic material rankings baked into the app (*"oak is 8/10, walnut is 9/10"*)
- ❌ Score-based comparison surfaces that hide the reasoning
- ❌ Recommendation engines that don't show which principles led to the recommendation
- ❌ Any answer that could be produced by a lookup table rather than by composition
- ❌ Boilerplate hedging (*"as always, results may vary"*) at the end of every answer

## Why this is a Product Constitution principle, not just a UX guideline

The temptation to encode principles as rigid rules is enormous. It's easier to build. It's easier to test. It scales more predictably. Every module built without this principle in mind will drift toward *lookup software* over time — because that's the path of least resistance.

Making it a **constitutional principle** means every future module — Hardwood Calculator, Staircase Calculator, Buying Intelligence, Specification Intelligence, Estimation, Stock Intelligence, Vision Count, Message Centre — must design its answer surface around composition and judgement from day one. Retrofitting later is much harder.

## Relationship to the other principles

- **Principle 0001 (NEX quietly runs the paperwork)** — this principle governs *how NEX feels*. Q7 asks for confidence over automation; Q8 asks NEX to ask when uncertain. Principle 0003 governs *what a NEX answer contains*: reasoning, not verdicts.
- **Principle 0002 (Standard NEX Workflow)** — this principle governs *the shape of the workflow*. Steps 2 (understand context) and 3 (prepare the work) are where composition happens; step 4 (owner reviews) is where the reasoning must be visible for review to be meaningful.
- **Rules A/B/C (Reference Brain governance)** — this principle governs *what NEX may say*. The composition drawn on for each answer must trace to authored Brain modules; NEX may compose them into judgement but not invent principles beneath them.

Together the three principles + the three Rules answer the four questions every trustworthy answer must satisfy:

| Question | Governed by |
|---|---|
| Does NEX have permission to say this? | Rules A/B/C · Authored expert content only |
| Does it feel like a person said it? | Principle 0001 |
| Does the workflow support genuine review? | Principle 0002 |
| Is the answer shaped as judgement, not verdict? | **Principle 0003** (this) |

## Where this shows up first

- **Buying Intelligence** — the package-comparison card names the winner AND names why the alternative supplier's cheaper-baluster reasoning was misleading. Both sides of the case shown.
- **Specification Intelligence** — the comparison card explains what the price gap reflects; never claims the higher-spec quote is *"better"* alone.
- **Staircase Estimation** — every estimate carries risk factors, not just a total.
- **Material Watch** — trend + reason + recommendation. Never a bare trend.
- **The lamwood profile** — deliberately says *"in many applications the professional choice; long clear solid timber remains valuable where uninterrupted natural grain is desired"* rather than *"lamwood is better"*.

Every future module inherits the same discipline. Every review must ask: *would an experienced craftsman say it this way, or would only a lookup table say it this way?*

## Cross-references

- `docs/product-constitution/README.md` — the twelve quality-gate questions this principle sits alongside
- `docs/product-constitution/principles/0001-nex-quietly-runs-the-paperwork.md` · `0002-standard-nex-workflow.md`
- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/wood-intelligence-principles.md` — the six trade principles most commonly composed under this rule
- `feedback_nex_design_principle_tech_disappears.md` (Claude auto-memory)
