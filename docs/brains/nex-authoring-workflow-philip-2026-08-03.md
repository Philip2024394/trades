---
authored_by: Philip O'Farrell (workflow doctrine) · Master AI Engineer (workflow formalisation)
authored_role: Founder workflow + Master AI Engineer formalisation
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_b_no_ai_authored: pass on workflow · formalisation attributed
  rule_c_attributable_origin: pass · origin = Philip O'Farrell 2026-08-03
architecture_layer: L2_PROCESS · governs how new knowledge enters Nex
document_version: 1.0
composes_with:
  - docs/brains/nex-domain-template-philip-2026-08-03.md
  - docs/brains/nex-global-knowledge-domains-catalog-philip-2026-08-03.md
  - Constitution Rule c · Attributable Origin
---

# NEX Authoring Workflow · The Questions-First Model

## The Doctrine

Philip 2026-08-03: *"Don't aim to personally write 100,000 articles. Aim to write 100,000 questions and review the AI-generated answers."*

This is a SCALING refinement. Philip's role becomes: subject expert · standards author · final reviewer · knowledge owner · governance authority. Claude's role becomes: research assistant · technical writer · knowledge organiser · FAQ generator · article drafter · taxonomy builder · cross-link generator · duplicate detector.

## The Workflow (mandatory for every new knowledge entry)

```
Questions
    ↓
Claude clusters questions
    ↓
Claude creates article outline
    ↓
Claude writes draft
    ↓
Philip reviews
    ↓
Philip edits
    ↓
Brain document created (governance rule c: named_expert = Philip O'Farrell after review + edit)
    ↓
FAQs linked
    ↓
Images linked
    ↓
Examples linked
    ↓
Published to NEX
```

## The Duplicate-Detection Rule (composes with ADR-0028 Rule #12)

Claude MUST detect duplicates before drafting.

Example — three questions:
- *"Can I fit laminate flooring?"*
- *"Is laminate DIY friendly?"*
- *"Is fitting laminate difficult?"*

Wrong response: three articles.

Right response: ONE article — *"DIY Laminate Flooring Installation"* — with three FAQs linking to it.

Same knowledge · same voice · three query entry-points. Composes with the Foundation Brain 10 (Memory · never duplicate) and the Master Intent Library (Router funnels many phrasings into one intent).

## The Cluster-First Rule

Before drafting anything, Claude:

1. Reads the incoming question batch.
2. Clusters semantically-similar questions.
3. Proposes an outline that ONE article per cluster covers all clustered questions.
4. Philip approves the clustering OR redirects.
5. Claude drafts.
6. Philip reviews + edits.
7. Governance frontmatter added (rule c: named_expert = Philip O'Farrell).
8. Article + FAQs published.

## The Roles

### Philip (Subject Expert + Governance)

- Authors 100,000+ questions (his ongoing role).
- Reviews Claude's clustering.
- Approves the outline.
- Edits the draft into final voice.
- Signs off with rule-c attribution.
- Owns the taxonomy.
- Decides priority (which domain / which article next).
- Governs quality (rejects drafts that don't meet standard).

### Claude (Research + Drafting)

- Cross-references existing Brain docs to avoid duplication.
- Clusters incoming questions semantically.
- Proposes article outlines with sections + headings.
- Drafts articles using existing manifest images and cited sources.
- Generates FAQ Q&A pairs from the article.
- Auto-links related articles (cross-references).
- Detects duplicates against the existing corpus.
- Never publishes without Philip review.

## The Governance Frontmatter (mandatory on every published article)

Every article published via this workflow carries:

```yaml
---
authored_by: Philip O'Farrell (questions + review + edits) · Claude (draft)
authored_role: Subject expert authored + reviewed · AI drafted
captured_at: {date}
capture_medium: written questions + AI draft + human review + edit
governance:
  rule_a_anti_fabrication: pass · verified against existing corpus
  rule_b_no_ai_authored: pass on knowledge · draft form clearly marked
  rule_c_attributable_origin: pass · origin_type = named_expert (post-review) · expert = Philip O'Farrell
draft_by: claude
reviewed_by: philip
reviewed_at: {date}
edits_made: [list of substantive edits]
duplicate_check_passed: true
duplicate_check_against: [list of adjacent articles checked]
---
```

## The Question Bank Format

Questions are stored in `data/nex-questions/{domain-slug}.jsonl`:

```json
{"question": "Can I fit laminate flooring myself?", "domain": "flooring", "author": "philip", "captured_at": "2026-08-03", "cluster_id": null, "article_id": null}
{"question": "Is laminate DIY friendly?", "domain": "flooring", "author": "philip", "captured_at": "2026-08-03", "cluster_id": null, "article_id": null}
{"question": "Is fitting laminate difficult?", "domain": "flooring", "author": "philip", "captured_at": "2026-08-03", "cluster_id": null, "article_id": null}
```

Once Claude clusters + Philip approves:

```json
{"question": "Can I fit laminate flooring myself?", "domain": "flooring", "author": "philip", "captured_at": "2026-08-03", "cluster_id": "diy_laminate_install", "article_id": "flooring-diy-laminate-install-2026-08"}
```

Cluster IDs become article slugs. Multiple questions → same cluster ID → one article.

## The Duplicate-Detection Algorithm

Before Claude drafts anything, it runs:

1. Semantic similarity search across existing FAQ database (`knowledge/{domain}.json`).
2. If any existing FAQ has >0.85 semantic similarity to the new question → surface the existing FAQ + ask Philip whether to redirect or genuinely author new.
3. If any existing article covers the topic at >70% relevance → surface the article + propose enhancement instead of new authoring.
4. Only after clearing duplicate check does drafting begin.

Composes with ADR-0028 Rule #10 (Never guess) and Rule #12 (Never lose knowledge).

## The Review Pipeline

Every draft passes through Philip in this order:

1. **Clustering review** — did Claude cluster correctly?
2. **Outline review** — is the outline complete + correctly ordered?
3. **Draft review** — is the content accurate + on-voice + right depth?
4. **Edit** — Philip edits directly in the file (never review-in-comments · always edit-and-commit).
5. **FAQ verification** — do the extracted FAQs match the article?
6. **Cross-link verification** — are the referenced articles the right ones?
7. **Governance sign-off** — Philip adds/updates the rule-c line.
8. **Publish** — article + FAQs land in the domain's directory + surface in Router.

## Success Metric

*Philip's effort per article drops from ~2 hours (write from scratch) to ~20 minutes (review + edit AI draft). Knowledge base grows 6x faster while maintaining the same rule-c attribution standard.*

## Anti-Patterns

- **Claude publishes without review** — never. Rule c requires named_expert final sign-off.
- **Claude fabricates a citation** — never. Rule a. Every claim traces to a verifiable source or Philip's own knowledge.
- **Claude ignores duplicate check** — never. Same knowledge, one article, many FAQ pointers.
- **Philip writes 10,000 words instead of asking 10,000 questions** — inefficient use of Philip's time.
- **Claude drafts without clustering** — leads to fragmented, overlapping articles.

## Cross-Domain Application

This workflow applies to EVERY domain. Staircase's remaining backlog (~1000 unauthored FAQ titles Philip captured) will be processed through this workflow. Every new domain (Kitchen · Marketing · Finance · etc.) starts with Philip authoring the QUESTION BANK, then Claude drafts, then Philip reviews.

## The Meta-Rule

**Philip writes questions. Claude drafts. Philip reviews. Nex learns.**

That four-step loop, repeated 100,000 times over the next 2-3 years, is how Nex accumulates the largest structured trade + business + life knowledge base in the world — while every single answer remains attributable to a named human expert.

## Enhancement Opportunity

Every AI competitor either (a) scrapes internet content of unknown provenance, or (b) requires human experts to write everything from scratch (doesn't scale). Nex uses a HYBRID that combines Philip's expertise + Claude's drafting speed + Philip's final review — the fastest scalable path to a rule-c-compliant knowledge base at 100,000+ article scale. That is untouchable authoring throughput.
