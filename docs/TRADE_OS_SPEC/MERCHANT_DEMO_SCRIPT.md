# Trade OS · Merchant Demo Script

Minute-by-minute walkthrough for a first-time merchant. Star (★) marks
steps that work end-to-end today. Dagger (†) marks steps still under
build — script calls them out honestly so the demo never bluffs.

**Persona**: James, 34, carpenter in Leeds. Ford Transit Custom van, no
website, no brand. Wants to look established by Friday for a big quote.

---

## Minute 0 — arrival

James clicks a link a friend sent → lands on `/studio`.

**Screen**: The Networkers sign-in gate. Cream background, yellow dot,
"Sign in with the magic link" copy.

James signs in via magic link → `/studio` redirects.

**Where he lands next depends on whether he has a Brand DNA already:**
- New merchant → `/studio/discovery` ★
- Returning merchant → `/studio/vault` ★

---

## Minute 1 — Discovery ★

**Screen**: `/studio/discovery` — one clear question at a time. Yellow
progress dots at top. Big textarea. Big Next button.

James answers 7 questions:
1. What work makes you the most money? → "First-fix + built-in wardrobes"
2. What customer do you want more of? → "Homeowners doing extensions"
3. Which areas? → "Leeds, Wetherby, Otley"
4. What makes customers choose you? → "Turn up on time, tidy site, priced fair"
5. Existing logo/colours? → "No"
6. Upload 3 best jobs → skipped (optional)
7. Which van? → "Ford Transit Custom"

**Minute 3**: submits. Nex creates his Brand DNA. Screen shows fingerprint + "Brand DNA saved."

**What just happened invisibly:**
- 7 answers → BrandRecord v1
- SHA-256 fingerprint (deterministic uniqueness)
- Row into `hammerex_brand_identity`
- Cascade subscribers primed to fire on future edits

---

## Minute 3 — Brand Vault ★

**Screen**: `/studio/vault` — 6-zone home. Hero shows "Welcome James · Brand Health 68%." Quick actions strip: Generate · Improve · Compare · **Export** · Ask AI.

Below: My Brand tiles (Logo, Colours, Typography, Brand Guide, Photography). Every tile shows current state.

James clicks **Generate** on the Van tile.

---

## Minute 4 — Van Wrap Studio ★

**Screen**: `/studio/studios/van-wrap` — two panels. Left: optional
guidance textarea. Right: generation preview area.

James types: "big phone number, focus on wardrobes."

Clicks **Generate Van Wrap**. Nex compiles the prompt (deterministic),
routes to GPT Image 1, fires generation, runs the Critic loop, and
persists the recipe.

**Minute 6**: van image appears. Score 94, cost £0.32, latency 41s. Critic
approved. Compiled prompt visible in a details block. Buttons: Try
Again, Export Brand Package.

**What just happened invisibly:**
- 14-stage compiler ran (trade rules, accessibility, print rules injected automatically)
- GPT Image 1 fired
- Vision critic scored 12 axes
- `hammerex_van_generations` row inserted
- `hammerex_generation_costs` row inserted
- `Asset.Generated.v1` event published

---

## Minute 7 — Business Cards to match ★

Two paths available:

**Path A — click**: James goes back to Vault, opens Capability Store,
clicks Business Cards. Or navigates `/studio/store`.

**Path B — talk to Nex** ★: James clicks the Nex pill in the header →
`/nex` chat.

He types: "business cards to match my van."

Nex detects intent → invokes `print.business-card` Studio with James's
Brand DNA. Router picks Ideogram v3 (typography wins). Compile → generate
→ critic → persist.

**Minute 9**: business cards appear inline in the chat. Same brand
colours, same typography, print-ready with CMYK + 3mm bleed automatically
applied by the compiler's print rules.

---

## Minute 10 — What's a mobile app? †

James asks Nex: "can I get a mobile app for my customers?"

Nex response today: "Mobile App Studio isn't shipped yet — it's next
after Website. Want me to add you to the beta list?"

**Honest**: this is not a lie. The pattern is proven; the Studio isn't built.
Timeline: ~2 hours to add given the template, plus UI design.

---

## Minute 11 — Change of heart on colour ★

James decides yellow feels too tradesman-generic. He types to Nex:
"change my brand colour to dark green like the wagon he'd been thinking of."

Nex → "To swap your colour, open the Brand Vault — I'll cascade the change through every asset."

James opens Vault → clicks Colours tile → picks Dark Green → save.

**What just happened invisibly:**
- `PATCH /api/studio/brand/update` fires
- `Identity.ColourChanged.v1` event published
- Subscriber flags every prior van generation stale (with `stale_reason: brand.colour_changed`)
- Next time James asks Nex for a van, it'll re-compile with the new colour

---

## Minute 13 — Ask Nex a trade question ★

James types: "what's the VAT threshold this year?"

Nex retrieves from `hammerex_nex_knowledge_entries` → returns:

> UK VAT threshold rose to £90,000 turnover April 2024. Register within
> 30 days of exceeding. Voluntary registration below threshold recovers
> input VAT on tools + van but adds 20% to every invoice.

Source chip: "business · vat-threshold". Provenance visible.

---

## Minute 15 — Website hero †

James: "I need a website."

Nex today: "Website Studio ships next slice. You can already export
your Brand DNA + tokens as a ZIP that any web dev can consume in 5
minutes. Want the export?"

James clicks yes → Nex points at Vault → Export button.

**Minute 17**: ZIP downloads. Contains Brand DNA JSON, Tailwind config,
CSS variables, colour palette CSV, README with print recommendations,
every recipe he's generated.

---

## Minute 18 — Send a quote to a real customer †

Quote flow lives in the existing Networkers platform (`/apps/notebook/quote-requests`),
not Trade OS. Cross-linked from Vault but not part of this pass.

---

## Minute 20 — Customer approves online †

Same — Customer Portal is a Networkers feature (SiteBook), not a Trade OS Studio.

---

## Minute 22 — Marketing post †

Social Post Studio is on the roadmap. Not yet shipped. Nex acknowledges
honestly and points to the "future" list.

---

## Minute 25 — recap

James walks away with, in 25 minutes:
- Brand DNA created (v1, editable forever)
- Van wrap generated + saved as recipe
- Business cards generated + saved as recipe  
- Cost so far: ~£0.60 in AI
- Downloaded ZIP export of everything
- Learned a real business fact from Nex's knowledge base

---

## What sells the demo

**The "instead of clicking" moment**: minute 7. James asks Nex for
business cards and Nex builds them. First time in his life he's talked
to a business tool. That's the visceral moment.

**The cascade moment**: minute 11. Change one colour, everything
downstream flags stale automatically. First time he's ever had a
"single source of truth" click.

**The export moment**: minute 17. He downloads his brand package with
recipes included. He owns it. He can leave any time.

---

## What kills the demo

- Any step where James has to explain what he wants twice.
- Any Studio that takes > 60s to generate.
- Any moment Nex bluffs about a feature that isn't shipped.
- Any "under construction" page instead of an honest "we're building this next."

The script above marks † for every future feature. **A demo that says
"not shipped yet, here's the workaround" is more credible than one
that fakes it.**

---

## Sales-friendly one-liner

> "James, a Leeds carpenter with no brand, walked away in 25 minutes
> with a professional van design, business cards to match, and his
> entire brand as a portable ZIP. He typed like he was texting a mate,
> and Nex built the work. That's Trade OS."
