# Studio onboarding — 7 questions (Philip's canonical set)

Merchant pays £14.99, signs up, and answers these 7 questions. Server-side composes a full profile via `/api/studio/ai/compose`. Merchant reviews + tweaks. Publishes in ~2 minutes total.

**These 7 questions cover strictly more than any Lovable-style prompt input can, because they carry structured intent — the LLM doesn't have to guess what the merchant means.**

---

## The 7 questions

### 1. What best describes your business?
Single-select:
- Tradesperson
- Building Supplier
- Trade Company
- Manufacturer
- Equipment Hire
- Other

### 2. What trade or industry are you in?
Free text with autocomplete against `TRADE_OFF_TRADES`. Examples:
- Builder / Electrician / Plumber / Carpenter / Roofer / Scaffolder / Painter / Landscaping
- Timber Merchant / Plumbing Supplies / Electrical Wholesaler

### 3. What do you offer?
Single-select:
- Services only
- Products only
- Both products and services

### 4. Tell us about your business.
Free text (~200 chars). "A short description of what you do and what makes your business different."

### 5. Where do you work or deliver?
- Select your town/city (dropdown of UK regions)
- How far do you travel? (numeric miles OR "regional" / "national")
- Do you deliver products nationally? (yes/no — only appears if Q3 = Products or Both)

### 6. How can customers contact you?
Multi-select:
- Phone
- WhatsApp
- Email
- Website
- Facebook
- Instagram
- TikTok

### 7. What would you like your app to include?
Multi-select checkboxes:
- ☐ Company profile
- ☐ Product catalogue
- ☐ Service listings
- ☐ Instant chat
- ☐ Quote request form
- ☐ Appointment booking
- ☐ Link in Bio page
- ☐ Photo gallery
- ☐ Videos
- ☐ Customer reviews
- ☐ Directions / Map

---

## What the AI determines from just these 7 answers

Every downstream design decision flows from this input:
- **Business type + trade** → hero + tone + which apps auto-install
- **Products vs services vs both** → primary page composition + navigation menu
- **Description** → hero eyebrow + subhead + About section copy
- **Location + travel** → service-area map + postcode targeting + WhatsApp deep-link intro
- **Contact methods** → footer + sticky CTA + which social icons render
- **App pages** → EXACTLY which sections appear in the page

## Real page compositions (Philip's spec)

### Builder + Services only
```
Home / About / Services / Gallery / Quote Request / Reviews / Contact
```

### Timber Merchant + Products only
```
Home / Product Catalogue / Categories / Delivery Areas / Trade Counter / Contact
```

### Builder + Products + Services (hybrid)
```
Home / Services / Products / Gallery / Instant Chat / Booking / Contact
```

## Downstream mapping (how the wizard turns answers into sections)

The Day 4 wizard hits `/api/studio/ai/compose` once per required page slot. Each call sends:
- The merchant context (name, trade, city, quals, reviews)
- The 7-answer summary as `intent`
- The slot's `library` filter (hero / services / product_grid / faq / cta / contact)

Server picks the best-fit section for that slot from the catalog + fills params with merchant-specific content.

## Refuseable questions

Q4 (description) is the only free-text answer that can be skipped. If skipped, LLM writes it from the trade + years + reviews. Every other question drives structural decisions and must be answered.

## Total time: ~60 seconds

Q1–Q3, Q5–Q7 are all pick-based (single-select or checkbox). Q4 is the only typing question. Real merchant time-to-first-preview: 45-90 seconds.

## Notes on Q7 "Instant chat"

Selecting Instant chat = merchant wants in-app messaging (not just WhatsApp handoff). This unlocks a private chat surface on their profile so customers can message inline. **Separate build required** — not in the current shell. Yardinbox pattern can be reused. Flag for Path B Day 4+ or a later slice.

---

**Status: APPROVED by Philip 2026-07-09. Canonical.**
