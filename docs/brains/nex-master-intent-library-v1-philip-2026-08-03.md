---
authored_by: Philip O'Farrell (doctrine · 10 universal verbs + 3-layer routing) · Master AI Engineer (implementation synthesis)
authored_role: Founder doctrine + Master AI Engineer implementation
captured_at: 2026-08-03
capture_medium: written contribution
governance:
  rule_a_anti_fabrication: pass · doctrine authored by Philip · phrasing library grown from Philip's dumps
  rule_b_no_ai_authored:   pass on doctrine · synthesis clearly attributed
  rule_c_attributable_origin: pass · doctrine origin = Philip O'Farrell · synthesis = Master AI Engineer 2026-08-03
architecture_layer: L2_ROUTING · governs Phase B of the Untouchable Plan
document_version: 1.0
composes_with:
  - docs/brains/nex-foundation-brains-roadmap-philip-2026-08-03.md
  - Constitution Second Law (Understanding)
  - Constitution 9 Principles
---

# NEX Master Intent Library v1.0

## The Doctrine

Philip 2026-08-03: *"Rather than building a list of 10,000 questions, create a NEX Intent Universe. Every question belongs to one of around 100 core intents. The Router learns those intents, while your knowledge bases provide the specialist expertise. That approach scales far better than trying to hard-code every possible question, while still letting NEX understand the natural language people use every day."*

## Position in the Untouchable Flow

```
[Foundation Brains] → [ROUTER] → [Specialist Brains]
                          ▲
                          │
                          THIS LAYER
```

## The 10 Universal Verbs (Layer 1 · Universal Intent)

Every user request in the world can be mapped to ONE (or occasionally two) of these ten verbs:

| # | Verb | Meaning | Example Phrasings |
|---|---|---|---|
| 1 | **Create** | Generate something new | *"design my logo" · "build my website" · "write a blog" · "generate a quote" · "make me a banner" · "create today's Facebook post" · "design my staircase"* |
| 2 | **Communicate** | Deliver a message | *"reply to this customer" · "write a follow-up email" · "translate this" · "send appointment reminders" · "write a thank-you"* |
| 3 | **Decide** | Compare + choose | *"oak or pine?" · "which is best?" · "should I use glass balustrades?" · "compare these quotes" · "help me pick"* |
| 4 | **Plan** | Organise a sequence | *"plan my renovation" · "build a marketing plan" · "create a project schedule" · "plan next week"* |
| 5 | **Manage** | Ongoing state maintenance | *"track my customers" · "monitor stock" · "manage staff" · "organise my files"* |
| 6 | **Automate** | Delegate to run without asking | *"post every Monday at 9am" · "auto-reply to Facebook" · "schedule six months of content" · "chase overdue invoices"* |
| 7 | **Analyse** | Explain data | *"why did sales drop?" · "which post performed best?" · "show my dashboard" · "compare this month to last"* |
| 8 | **Learn** | Get taught something | *"teach me marketing" · "explain building regs" · "how do I install T&G?" · "what's the difference between MDF and MR-MDF?"* |
| 9 | **Improve** | Optimise existing state | *"improve my SEO" · "make my website faster" · "increase profits" · "reduce advertising costs"* |
| 10 | **Monitor** | Track + alert on change | *"tell me if a quote's older than 7 days" · "alert me to negative reviews" · "watch competitors" · "remind me before deadlines"* |

## The 3-Layer Routing Model

Every user request routes through three layers:

```
Layer 1 · UNIVERSAL INTENT      Create · Communicate · Decide · Plan · Manage · Automate · Analyse · Learn · Improve · Monitor
             ↓
Layer 2 · DOMAIN                 Staircase · Door · Kitchen · Window · Flooring · Marketing · Finance · Website · Legal · HR · Manufacturing · Design · Photography · Photography · Personal · Family · Health · Home · Business · Retail · Hospitality · Construction · Healthcare · Education
             ↓
Layer 3 · CAPABILITY             Answer · Generate · Design · Calculate · Schedule · Monitor · Recommend · Quote · Report · Execute
```

**Example routings:**

| User says | Layer 1 | Layer 2 | Layer 3 |
|---|---|---|---|
| *"Build me a staircase quote"* | Create | Staircase | Quote |
| *"Create next month's social media"* | Create | Marketing | Generate + Schedule |
| *"Why are my Facebook posts not working?"* | Analyse | Marketing | Report |
| *"Remind me before every quote expires"* | Monitor | Sales | Schedule |
| *"Explain building regs for a loft stairs"* | Learn | Staircase | Answer |
| *"Post every morning automatically"* | Automate | Marketing | Schedule + Execute |
| *"Compare oak and walnut"* | Decide | Staircase | Recommend |
| *"Design my restaurant interior"* | Create | Interior Design | Design |
| *"Chase overdue invoices"* | Automate | Finance | Execute + Communicate |
| *"Organise tomorrow's diary"* | Plan | Personal | Schedule |

## Two-Router Architecture (composes with Governance Ruling 2026-07-31 addendum)

Per the existing addendum ruling, the Router is actually TWO routers:

- **Router 1 · INTENT** — Learn · Identify · Compare · Browse Images · Buy · Install · Troubleshoot · Quote (or the expanded 10-verb model above).
- **Router 2 · INFORMATION TYPE** — Definition · Dimensions · Function · Position · Material · Installation · Images · Comparison.

Every query resolves to: **Intent + Subject + Optional Filters**.

## The Phrasing Corpus (grown over time)

Philip's dumps 2026-08-03 supplied thousands of natural phrasings. Every phrasing is tagged with its 3-layer route and stored in `data/nex-intent-phrasings.jsonl` (one JSON per line, appendable). The classifier learns from this corpus.

Structure per row:
```json
{
  "phrasing": "help me sell more",
  "layer1_intent": "Improve",
  "layer2_domain": "Sales",
  "layer3_capability": "Recommend",
  "authored_by": "philip",
  "captured_at": "2026-08-03"
}
```

**Initial corpus seeded from Philip's 2026-08-03 dump:** ~2,000 phrasings across Business Startup · Making Money · Websites · Ecommerce · Artificial Intelligence · Office Work · Construction · Manufacturing · Customer Service · HR · Personal Life · Homeowner · Vehicle · Sales · Customer Management · Quotations · Inventory · Finance · Staff · Project Management · AI Assistant · Documents · Images · AI Design · Communications · Phone Calls · Text Messages · Calendar · Shopping · Travel · Printing · Legal · Education · Software · Health of My Business · Daily Dashboard · AI Staff · Home Users · Creative · Entertainment · Smart Home · Banking · Procurement · Warehousing · Logistics · Compliance · Maintenance · Research · Presentations · Surveys · Community · Franchises · AI Business Coach · AI Life Assistant · Money · Time · Emails · Files · Voice · Video · AI Coding · Writing · School · Family · Real Estate · Garden · Cars · AI Agents · Home Automation · Shopping Assistant · Health · Entertainment.

## Governance

1. **Every new user request** that fails to route → auto-logged to `data/nex-router-unmatched.jsonl` for Philip review + phrasing library expansion.
2. **Every new phrasing added** must be Philip-approved (Rule c) or grown from real user interaction (attributable to a session ID + timestamp).
3. **Never inflate confidence** — if a phrasing routes with <70% confidence, ask the user rather than guessing (composes with Never-Guess Brain 14 + ADR-0030 confidence formula).
4. **Layer 2 domains are extensible** — new industries add new domains without changing Layer 1 or Layer 3.

## Success Metric

*95% of natural user phrasings route correctly to Layer 1 + Layer 2 + Layer 3 without asking a clarifying question. The remaining 5% ask ONE targeted clarification (never a menu, never a list of options) and route on the second try.*

## Enhancement Opportunity

The 10-verb Universal Intent model is the reason Nex will scale where competitors won't. ChatGPT/Claude/Gemini treat every request as a fresh generation task. Copilot/Siri map to app-specific commands. Nex maps to timeless verbs — the intent library is future-proof against every new industry, phrasing style, and language Nex will add over the next decade. **New industries add DOMAINS without rebuilding the Router. That is untouchable.**
