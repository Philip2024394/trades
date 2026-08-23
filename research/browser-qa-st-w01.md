# ST-W01 · Browser QA Script

**For:** Philip · **Corpus:** v1.1 · **Adapter:** `src/lib/staircase-knowledge/` · **Section:** `src/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-W01.tsx`

**URL:** http://localhost:3008/nex-app/design-catalogue/staircase/master-template-1

**Goal:** confirm the wizard actually works end-to-end · not just that it renders. HTML inspection has confirmed compile + mount. Everything below is behaviour I cannot verify without a real browser.

**How to use:** walk through each section top-to-bottom. Note any ✗ inline and screenshot if visual. Anything unmarked = passes.

---

## 1 · Activation (Philip 2026-08-18)

The wizard is no longer part of the passive scroll. It activates only from the "Get Your Staircase Quote" text button in the ST-H01 hero.

- [ ] In the hero, "Get Your Staircase Quote" (accent-styled text button) is visible next to the decorative image CTA
- [ ] Click → fullscreen overlay opens with the wizard mounted directly on Q1 (IdleCard is skipped because `autoStart` is passed)
- [ ] Round `×` close button at top-right dismisses the overlay
- [ ] Press ESC → overlay dismisses cleanly

## 2 · Q1 Country

- [ ] Header reads "Step 1 of 28" · progress bar shows ~3-4% fill (28 = ORDERED_NODE_IDS.length - 1 after the 2026-08-18 project-classification expansion)
- [ ] Question: "Which country will your staircase be installed in?"
- [ ] 19 country options render as a 2-column grid on desktop, single column on narrow mobile
- [ ] **Round flag image renders inside each country button** (left of the label, 32px round container with a subtle border · public-domain Wikipedia flag via flagcdn.com w80)
- [ ] "Somewhere else" option has NO flag (correct — no ISO code for OTHER)
- [ ] Below options: informational note reads "Staircase regulations will apply for each country."
- [ ] "I'm not sure — help me decide" chip renders below the options (dashed brown border)
- [ ] Reset button visible top-right; **do not click yet**
- [ ] No Back button (this is Q1)
- [ ] Pick "United Kingdom" → advances to Q2

## 3 · Progression + Back

- [ ] Q2 Location — Back button now appears
- [ ] Click Back → returns to Q1 with UK still selected (has the checked ring)
- [ ] Click UK again OR pick another country → advances to Q2

## 4 · Progress bar

- [ ] Every Q advances the progress bar
- [ ] Numbers make sense (Step N of 16)

## 5 · "I'm not sure" · WITH visual comparison

Nodes with `compare[]` in the decision tree: Q2, Q3, Q4, Q5, Q6, Q7, Q8.

- [ ] On Q3 Geometry, click "I'm not sure — help me decide"
- [ ] A portalled overlay appears above the whole page (fully covers, not clipped by the section)
- [ ] Grid of comparison cards renders (straight · quarter · half · winder · spiral · helical · curved)
- [ ] Each card: gradient placeholder (real images pending curation) · label · one-line plain description
- [ ] Hover a card → lifts slightly, brown border appears
- [ ] Press ESC → overlay closes without picking
- [ ] Reopen · click one card → overlay closes AND wizard advances to Q4 with that geometry selected

## 6 · "I'm not sure" · WITHOUT visual comparison

Nodes without `compare[]`: Q1, Q5b, Q5c, Q7a, Q9, Q10, Q11, Q12.

- [ ] On Q1 (country) click "I'm not sure" chip
- [ ] **No overlay opens** · wizard advances to Q2 flagged as "unknown"
- [ ] Reach Q7a Timber Species (via UK → primary_home → straight → timber → closed_string → closed riser → solid_timber)
- [ ] Q7a options show localised labels ("European Oak", "Walnut", etc.) — pick "European Oak"
- [ ] **CRITICAL:** on completion, the summary should show "European Oak" not "european_oak" (canonical fix)

## 7 · Reset

- [ ] Halfway through, click Reset (top right of active card)
- [ ] Wizard immediately returns to Idle state
- [ ] StaircaseDesign context cleared (no wood pre-selected in ST-M01 below)

## 7b · Q2_use help buttons (Philip 2026-08-18)

- [ ] On Q2 "Where in the building will the staircase go?" each option (except "I'm not sure") has a small round `?` button top-right
- [ ] Click `?` → inline explanation panel expands below the option (cream background, seal-toned)
- [ ] Click `?` again → collapses
- [ ] Clicking `?` does NOT select the option (button-in-button avoided via sibling positioned in `.opt-wrap`)
- [ ] Focus indicator is visible on `?` when Tab-navigated
- [ ] Multiple `?` panels can be open at once (state per-option)

## 7c · Project classification block (Philip 2026-08-18)

New nodes appended after Q13_extras. Walk through:

- [ ] **Q_property_type** · "What type of property is this?" · 6 options · help `?` visible on new_build / existing / extension / conversion / commercial
- [ ] Picking "New build" → advances to **Q_build_stage** (9 stage options)
- [ ] Picking "Existing property / renovation" instead → advances to **Q_replace_existing** (4 options)
- [ ] Picking "Commercial / other" → skips both branch questions, advances to **Q_opening_ready**
- [ ] **Q_opening_ready** · 4 options, first 3 have help `?`
- [ ] **Q_customer_type** · 5 options · picking "Private homeowner" skips VAT; picking any other advances to Q_vat_status
- [ ] **Q_vat_status** · 3 options
- [ ] **Q_install_required** · 3 options, top 2 have help `?`
- [ ] **Q_supply_market** · 3 options · picking "For export to another country" advances to Q_export_country (19-country selector with flags); "local" or "not sure" skips it
- [ ] **Q_project_stage** · 6 options
- [ ] **Q_attachments_info** · info-card (no options) · body copy about attaching in the follow-up chat · single "Continue →" button
- [ ] **Q_notes** · textarea · placeholder text visible · character counter shows `0 / 1200` · "Skip" and "Continue" buttons · empty submit still advances

## 8 · Complete state

- [ ] Progress fully through all questions (skip with "I'm not sure" where you don't want to think)
- [ ] Wizard shows **"Your project snapshot"** with eyebrow "New staircase project · draft specification"
- [ ] Snapshot is grouped into sections with accent-underlined headings: **Project · Customer · Commercial · Staircase** (in that order)
- [ ] Empty sections drop out (e.g. Customer has no VAT row when private homeowner)
- [ ] If you typed customer notes, they render below the tables as an italic serif blockquote
- [ ] Fields you answered show canonical labels
- [ ] Fields you skipped show "Not decided · specialist will confirm"
- [ ] If you skipped anything OR picked a specialist_review option (like bifurcated), the yellow flag appears with the reason
- [ ] Disclaimer paragraph reads: NEX doesn't calculate measurements etc.
- [ ] Three buttons: "Edit choices" · "Send to specialist →" · "Start over" (small link below)

## 9 · Edit + resume

- [ ] Click "Edit choices" → wizard returns to Q1 with all answers preserved
- [ ] Click through — each question shows the previously selected option as checked
- [ ] Pick a different answer → advance normally

## 10 · Handoff overlay

- [ ] From Complete state, click "Send to specialist →"
- [ ] Portalled overlay opens above whole page
- [ ] Shows: title · body · monospace summary block · "Not yet" + "Open NEX Chat →" buttons · footnote about NEX identity
- [ ] Summary block matches the summary card's contents
- [ ] Press ESC → closes
- [ ] Click "Open NEX Chat →" → **currently a stub · nothing happens · verify no error in console** (real handoff API is step 7 of the sequence)

## 11 · Canonical identity check (Principle 1)

- [ ] Restart wizard · pick UK · run to Q7a · pick "European Oak"
- [ ] Complete
- [ ] Scroll down to ST-M01 (Choose Your Wood) in the MT-1 scroll
- [ ] The Oak card in ST-M01 should show as selected (checked ring)
- [ ] If it does NOT: canonical slug mismatch — flag it. Wizard must write `oak`, not `european_oak`.

## 12 · Cross-section integration

- [ ] Restart · pick USA · run to Q7a
- [ ] Options show "Red Oak · White Oak · Hard Maple · Hickory · Cherry · Black Walnut · Pine"
- [ ] Pick "Red Oak" · complete
- [ ] Scroll to ST-M01 — no card matches (ST-M01 is UK-focused) — this is expected · not a bug
- [ ] Summary shows "Red Oak" (not "red_oak")

## 13 · Regressions in existing sections

- [ ] ST-M01 wood picker still works · picking a wood card lights it up
- [ ] ST-M01 "View All Woods →" activation still works
- [ ] ST-M01 detail panel still opens (Feel the wood / Not sure which timber CTAs at the bottom of detail)
- [ ] ST-P01 parts section still renders · lightbox still opens
- [ ] All other sections (N01, H01, T01, C01, B01, AB01, F01) unchanged

## 14 · Responsive · mobile

- [ ] Resize to 375px width (or iPhone SE mode in DevTools)
- [ ] All wizard states legible · buttons readable · no horizontal scroll
- [ ] Compare overlay fits screen, cards stack single-column
- [ ] Handoff overlay fits screen

## 15 · Keyboard + a11y

- [ ] Tab through the wizard · every button focusable in order
- [ ] Enter selects an option
- [ ] ESC closes any open overlay
- [ ] `role="radiogroup"` on options group, `aria-checked` on selected option (inspect DOM to confirm)

## 16 · Reduced motion

- [ ] DevTools → Rendering → prefers-reduced-motion: reduce
- [ ] Reveal wrapper still shows section (no infinite hidden state)
- [ ] Overlay fade-in still functions (or is disabled gracefully)

## 17 · Console

- [ ] Full walkthrough with DevTools console open
- [ ] Zero red errors
- [ ] Any legacy-shape warnings from the adapter (`[staircase-knowledge] ... legacy string option ...`) — should be ZERO after the v1.1 bump

---

## After QA

Once this checklist passes end-to-end, we're clear to build:
- Real compare-card images (25 images per `research-gaps.md` §H1)
- **NEX Staircase Submission object** (the next architectural step per Philip's Principle 3)

If anything fails, note the item number + a short description and hand back. Most likely failure modes I'd expect:
- Canonical wood slug mismatch (item 11) if a downstream section normalises differently
- Overlay clipping if a Reveal ancestor gained a new transform
- Focus trap missing in overlays (I haven't wired one · lightweight impl if needed)
