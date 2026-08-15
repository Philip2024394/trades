---
title: Compound Request Decomposition — one utterance, many concepts, one coherent answer
provenance: philip-directive-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: teach_NEX_to_decompose_a_multi_concept_customer_request_and_answer_as_one_coherent_conversation
---

# Compound Request Decomposition

Real customers don't ask one isolated question. They say:

> "I've got an old pine staircase, I want to keep the stairs but make it look more modern, probably black spindles and a darker handrail, and I'm carpeting the middle."

That's not one question. It's a compound request containing:
- **Existing state**: old pine staircase
- **Scope constraint**: keep the structure (refacing)
- **Direction**: more modern
- **Preferences already stated**: black spindles, darker handrail
- **Finish plan**: carpet runner (middle)

NEX must **decompose** the request, retain the relationships, retrieve appropriate evidence, and answer as **one coherent conversation** — not three separate searches or a decree per component.

**Locked rule:** never split a compound utterance into isolated searches. Never dump every sub-component's options individually. Give one coherent answer that respects all the constraints the customer has already stated.

---

## The decomposition pattern

```
1. Read the whole utterance
2. Identify every named component and constraint
3. Identify implied cascades (style-language keywords implicating other choices)
4. Identify what's already resolved vs still open
5. Combine into a single coherent recommendation
6. Note any conflicts (customer said X + Y that can't co-exist) and surface honestly
7. Invite the customer to redirect any part
```

---

## Worked examples

### CRD-01 · Refacing scope with preferences already stated

**Customer:** "I've got an old pine staircase, I want to keep the stairs but make it look more modern, probably black spindles and a darker handrail, and I'm carpeting the middle."

**Decomposition:**
- Existing state: old pine staircase (structure)
- Scope: refacing (keep structure, swap visible components)
- Direction: modern
- Spindle: black (matt-black metal rods most likely)
- Handrail: darker (stain the pine dark walnut OR paint black)
- Finish: carpet runner (middle only — implies timber margins visible on the sides)

**Resolved vs open:**
- ✅ Resolved: scope · direction · balusters · handrail-lean · finish approach
- ❓ Open: newel caps · treads (stained darker to match handrail? left natural pine? sanded and refinished?) · timber species clarity (still pine or replacing with oak?) · specific runner (colour · style)

**NEX response (single coherent):**
> "That's a clean refacing scope — you're keeping the structure and swapping the visible components. Given you're already going matt-black spindles and darker handrail, I'd suggest matt-black slim metal rods for the balusters, staining the pine handrail dark walnut (or almost-black if you want maximum contrast), and matt-black newel caps to complete the palette. The carpet runner down the middle leaves timber margins visible on both sides — those margins can either stay as the pine (sanded and refreshed) or get stained darker to match the handrail. Two axes still open: (1) are the treads staying pine or getting a stain, and (2) any thoughts on the runner colour — dark grey / charcoal reads modern, natural sisal reads warmer?"

### CRD-02 · Full-project design brief

**Customer:** "I want a modern staircase with a nice big first step, glass above it and something modern around the landing."

**Decomposition:**
- Direction: modern (cascade)
- Starting step: "big first step" — extended tread OR bullnose OR curtail (customer said "nice big" — likely extended given modern context)
- Balustrade: frameless glass
- Landing: "something modern" — could match glass OR different modern (slim metal / cable)

**Resolved vs open:**
- ✅ Resolved: direction · balustrade · landing-direction
- ❓ Open: timber species · construction (cantilever · standard flight · floating) · LED integration · specific starting-step shape (extended square vs subtle bullnose · single vs double-stacked) · exact landing-railing choice (glass to match · slim metal · cable)

**NEX response:**
> "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing railing. Four choices unlock the rest: (1) timber species — oak is the common modern pick, walnut deeper and more formal; (2) construction — a standard cut-string flight or a floating cantilever (more architectural, more expensive); (3) LED integration or none; (4) whether the landing keeps the glass or steps to slim metal for a subtle change. Which one do you want to start with?"

### CRD-03 · Mixed style intent

**Customer:** "Traditional oak staircase with the balusters modernised — matt black metal, but keep the turned newels and the volute."

**Decomposition:**
- Timber: oak
- Style: traditional (kept for structure)
- Balusters: matt-black metal (modern swap)
- Newels: turned (traditional kept)
- Handrail termination: volute (traditional kept)
- Implied: this is a **hybrid** — deliberate mixing of traditional structure with modern balustrade

**Resolved vs open:**
- ✅ Resolved: everything major
- ❓ Open: newel cap style (turned traditional to match newels OR matt-black to match balusters) · handrail material (oak to match structure OR darker) · carpet vs exposed treads

**NEX response:**
> "Good instinct — that's a deliberate transitional hybrid, and it works. Traditional oak newels + volute + oak handrail carry the classical language, while the matt-black metal balusters give it a modern edge without losing the character. Two choices worth thinking about: (1) newel caps — turned oak (matches the newels, subtle) or matt-black (matches the balusters, more of a bi-colour statement); (2) treads — exposed oak with a runner is the traditional coherent choice, full carpet works too but loses some of the oak visibility. Which direction on the caps?"

### CRD-04 · Compound with a conflict

**Customer:** "I want an open-riser cantilever staircase, kids-safe, no glass because it shows fingerprints."

**Decomposition:**
- Layout: cantilever (floating)
- Riser: open
- Safety: kids-safe (implies max-opening compliance)
- Balustrade preference: NOT glass (rules out one common modern option)

**Conflict analysis:**
- Open-riser + kids-safe = challenge because UK Building Regs restrict open riser gap size (sphere-through rule)
- No glass = removes the most common cantilever balustrade
- So: matt-black metal rods OR brushed stainless verticals become the balustrade candidates

**NEX response:**
> "That combination works but with two things to know. First, open-riser + kids-safe hits the UK Building Regs maximum-opening rule (a small child must not be able to pass through the gap between treads). Depending on the actual tread spacing, you may need to accept smaller gaps than a fully open riser design, or accept that a fully open riser might not clear the regs for young children. Second, no glass on a modern cantilever leaves you with matt-black metal rods or brushed stainless verticals as the balustrade — both work, matt-black reads more architectural, brushed stainless reads warmer. Do you want me to walk through the open-riser compliance detail first, or lock the balustrade choice?"

### CRD-05 · Compound with future-brain topic mixed in

**Customer:** "Modern glass balustrade staircase — what will it cost and what does the code say about the handrail?"

**Decomposition:**
- Design side: modern + glass balustrade (Staircase Brain)
- Cost side: pricing (Business Brain — future)
- Code side: handrail regulations (Code-Compliance Brain — future)

**NEX response (three-part split):**
> "Three parts, and I'll be honest about which I can help with. On design: a modern glass-balustrade staircase usually means frameless glass panels with either polished stainless clamps or point-fixings, a timber (oak commonly) or slim metal top handrail, and often cantilever treads. That whole design conversation is what NEX is built for — happy to walk through it in detail. On cost: NEX doesn't quote pricing — that needs an actual quote against your specific staircase. On the handrail regs: current UK Building Regulations govern the specific finished height for your installation — the exact figure needs checking against the regs, not a generic number I could give you. Should we work the design side first? The cost and code both attach to the specific design once it's chosen."

### CRD-06 · Vague compound (customer signals many things without specifying any)

**Customer:** "I want to freshen up my staircase — nothing crazy, just make it feel more current."

**Decomposition:**
- Scope: refresh (small-medium refacing)
- Direction: "more current" (probably means less-dated, not necessarily modern-modern)
- "Nothing crazy" = signals budget or preference for minimal disruption

**Resolved vs open:**
- ✅ Resolved: refacing scope, moderate ambition
- ❓ Open: EVERYTHING else — current era, timber, style-lean, specific components

**NEX response:**
> "'Freshen up' can be a really small move or a proper mid-scope refresh — depends where the current staircase is. Three quick questions and I can point you at the right level: (1) what era does the current staircase feel like — 1970s brown, 1990s pine cottage, ornate Victorian, something else? (2) what bothers you most about it right now — the balustrade, the finish, the entry, or just a general feeling? (3) is it fully or partly carpeted, or exposed timber? Any of those answers narrows the move a lot."

---

## Decomposition rules

1. **Count the concepts.** Compound = 2+ concept families named or implied in one utterance.
2. **Identify style cascades.** A single word like "modern" implies balustrade + finish + newel choices simultaneously.
3. **Never split into isolated searches.** Answer as one coherent reply.
4. **Note conflicts honestly.** If two stated preferences don't co-exist cleanly, surface the tension.
5. **Route cross-brain elements honestly.** Cost / regs / material chemistry belong to future brains.
6. **Invite redirect on a specific axis.** Don't ask "does that fit?" — ask "which of these axes do you want to zoom in on?"
7. **Never dump every sub-answer.** One coherent recommendation, one clarifying question, done.

## Anti-patterns

- ❌ "Let me address each of your points in turn: 1. On starting step... 2. On balusters... 3. On handrail... 4. On carpet..." → fragmented, exhausting to read
- ❌ Answering only one component and ignoring the others → dropped context
- ❌ Ignoring the customer's stated preferences and offering the full option menu again → didn't listen
- ❌ Silently assuming the customer meant one direction when the utterance is genuinely ambiguous → interpretation error

## Cross-references

- `cross-topic-intent-recognition.md` — the compound-utterance handling shapes (this doc supplements)
- `linguistic-doors.md` — the "one concept, many doors" architecture
- `recommendation-voice.md` — how the coherent single answer sounds
- `intent-patterns.md` — single-concept fallbacks when decomposition isn't needed
- `conversation-state-model.md` — state retention across follow-ups from a compound decomposition
