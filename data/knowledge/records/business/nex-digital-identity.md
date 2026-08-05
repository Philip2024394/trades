---
record_id: business_nex_digital_identity_v1
record_version: 1.0.0
created: 2026-08-06
last_reviewed: 2026-08-06
reviewed_by: "Research Claude session 2026-08-06 · Philip authorised"
supersedes: []
status: DRAFT
review_due: 2027-08-06

title: NEX Digital Identity
category: NEX Business Operating System · Platform Knowledge
subcategory: Onboarding · Identity · Public Presence
primary_audience: business-owner
alt_audiences: [homeowner, engineer]

constitutional_status:
  gold_standard_v1: true
  clauses_exercised: [1, 2, 3, 4, 5, 6, 7, 8]

owner:
  canonical_owner: NEX Product · Identity Engine team
  authored_by: Research Claude
  authorised_by: Philip

voice_law: "no 'At NEX, we…' phrasing per HARD LAW 2026-07-27"
---

# NEX Digital Identity

## Summary

Every NEX business account is issued a permanent Digital Identity comprising three separate layers: an internal NEX ID (never exposed to public UI), a country-scoped public NEX Address that becomes the business's canonical shareable link (asknex.app/uk/oakstairs), and an optional Custom Domain the business owns and connects (oakstairs.co.uk). Identity is deliberately separated from branding — the business name, logo, contact details, and even the connected domain can change without losing followers, reviews, links, or history.

---

## Structured Knowledge

### What NEX Digital Identity Is

NEX Digital Identity is the identity infrastructure every NEX business account is issued at signup. It is not a settings preference and not an optional feature — it is the platform's core identifier for the business. Every product and page inside NEX (Business Profile, Trade Centre listing, portfolio, reviews, quotations, AI Business Assistant, bookings, invoices) is a projection of the same underlying identity. Because identity is a first-class capability rather than a bundle of loosely-related settings, a business rebrand or a domain change does not fragment the record; the identity persists and the presentation layer adjusts.

The Digital Identity system serves two purposes simultaneously. For the business, it removes the "build a website" hurdle from onboarding by making a working public business page live from the first minute of the account. For NEX, it establishes an addressable substrate on which every future feature (payments, bookings, marketing intelligence, marketplace listings, verification, trust signals) can plug in without additional identity plumbing.

### The Three-Tier Identity Model

The Digital Identity separates concerns into three deliberately independent layers. Each layer changes on a different timescale, and the separation is what allows a business to rebrand or migrate domains without losing history.

**NEX ID** is the internal permanent identifier. It has the form `NX-8F2K91XA` (short hash) or `NX-10483922` (numeric). It is never exposed in public UI unless a support ticket or API integration explicitly needs it. It never changes for the lifetime of the account. Every other identity attribute — public handle, business name, logo, custom domain — is a mutable field that references the NEX ID.

**NEX Address** is the permanent public URL of the business page. It has the form `asknex.app/uk/oakstairs`, `asknex.app/ie/oakstairs`, or `asknex.app/au/oakstairs`. It is country-scoped, so businesses with the same name in different countries do not collide. The NEX Address is free at signup, reserved automatically during onboarding, and works forever (barring account closure or policy violation). QR codes, business cards, van signage, invoices, review links, SEO citations, and backlinks all continue to work over years because the NEX Address does not change.

**Custom Domain** is the optional third layer. A business that owns its own domain (`oakstairs.co.uk`, `oakstairs.ie`, `oakstairs.com.au`, `oakstairs.com`) can connect it to the same NEX Business Page through the AI Domain Assistant. The custom domain becomes the primary public URL while the NEX Address continues to work in the background. If the business later rebrands and buys a different domain, the connected domain can be swapped without changing the NEX Address or losing history.

### Identity vs Branding · a deliberate separation

Identity and branding are not the same thing. Identity is what makes a business the *same* business over years. Branding is how it currently presents itself. NEX enforces this distinction so that rebrands, domain changes, and even ownership transfers do not fragment the underlying record.

**Identity attributes** (rarely change):
- NEX ID (immutable)
- NEX Address (immutable barring policy violation)
- Public Handle — the Instagram-style unique handle (`@oakstairs`) — may change subject to reservation policy

**Branding attributes** (change freely):
- Public Name (the display name, e.g., "Oak Staircases Ltd")
- Logo
- Colours
- Contact details
- Custom Domain
- Business description
- Portfolio content
- Trading name

If "Oak Staircases Ltd" rebrands to "Northern Stair Co.", the NEX ID, NEX Address, followers, reviews, and history remain intact. Only the branding attributes change. This is what makes NEX Digital Identity a durable business asset rather than a website account.

### The NEX Address · the canonical permanent link

The NEX Address is the single most important asset the Digital Identity system delivers. Its four defining properties are:

**Country-scoped by design.** Every NEX Address includes a country code path (`/uk/`, `/ie/`, `/au/`, `/us/`, and so on). This resolves the "same business name in different countries" collision structurally, without any conflict resolution logic. A business named Oak Staircases can exist independently at `asknex.app/uk/oakstairs`, `asknex.app/ie/oakstairs`, and `asknex.app/au/oakstairs`.

**Permanent.** The NEX Address does not change once assigned. Businesses can print it on invoices, embed it in QR codes, put it on van signage, and use it in SEO citations without fear that a future rebrand or domain change will break the link. Preserving link stability at this level is a distinct architectural discipline from preserving branding stability, and it is why the two layers are separated.

**Free at signup.** No domain purchase is required to receive a professional public business page. The NEX Address is included with every business account, at every subscription tier. Custom domains are an optional upgrade for businesses that want their own branded URL, but the free NEX Address never expires and never becomes second-class.

**SEO-native.** Each country-scoped path (`asknex.app/uk/oakstairs`, `asknex.app/ie/oakstairs`) is a separately indexable page for local search. Search engines treat them as distinct regional pages, which supports local discovery without the business having to build separate regional websites.

At signup, NEX automatically reserves the best available NEX Address and shows it as *"✓ Available — Your permanent NEX address."* If the exact match is taken, NEX suggests variants (`asknex.app/uk/oakstairsltd`, `asknex.app/uk/oakstairsmanchester`). Some names are protected from reservation regardless of availability (see *Reserved Names* below).

### The Custom Domain · optional, connectable, changeable

Businesses that want their own branded URL can connect a Custom Domain purchased from any supported registrar. NEX supports plain-language DNS setup adapted to each major registrar (GoDaddy, Cloudflare, Namecheap, Squarespace, IONOS, Google Domains, Crazy Domains, Other). The Custom Domain becomes the primary public URL while the NEX Address continues to work in the background, with an optional automatic redirect.

**What the business owns:** the domain registration itself. NEX does not become the domain's registrar; the business retains full ownership through their chosen registrar. NEX manages only the connection between the domain and the NEX Business Page.

**What NEX manages:** the technical connection (DNS routing, SSL certificate provisioning, HTTPS enforcement, monitoring). SSL is enabled automatically for supported custom domains. DNS health is checked continuously.

**What happens if the business stops paying:** the custom domain connection may be paused until an eligible subscription is reactivated. The domain registration itself is not affected — it belongs to the business through its registrar. The NEX Address may continue to work depending on the plan. Under no circumstance does a lapsed subscription result in a 404 error or a broken link at the custom domain; the Smart Routing Engine ensures a graceful state instead.

### The Digital Identity Centre · one control surface

Every question the business owner might ask about their public presence is answered from one place. There is no separate "settings" screen scattered across different modules.

The side-drawer entry is `🌐 My Digital Identity`. The sections it contains are:

1. Business Profile
2. NEX Address
3. Custom Domain
4. Website Status
5. Search Engine Status
6. QR Code
7. Portfolio
8. Reviews
9. AI Business Assistant
10. Verification / Trust Score
11. Privacy
12. Visitors & Analytics
13. Share Business
14. FAQ & Help
15. Activity History

The governance rule is that anything touching public identity is not allowed to live elsewhere as a *"settings"* screen. If the owner needs to know who can find them, what their website is, whether Google is indexing them, or whether their AI is online, the answer is always in the Digital Identity Centre.

### The AI Domain Assistant · plain-language guidance

Most business owners have not configured DNS records before. NEX does not require them to. The AI Domain Assistant is a conversational flow that adapts its instructions to the specific registrar the business used.

**Example flow:**
- User: "I bought oakstairs.co.uk from GoDaddy."
- NEX: "Perfect. I'll guide you. Step 1: log into GoDaddy. Press Continue when you're in."
- User: (presses Continue)
- NEX: "Step 2: click DNS in the left menu. Press Continue when you can see your DNS records."
- User: (presses Continue)
- NEX: "Step 3: add a CNAME record. Host: `www`. Points to: `connect.asknex.app`. Press Continue when you've saved it."
- User: "Done."
- NEX: (checks DNS) "✓ Connected. SSL is being provisioned. This normally takes a few minutes."

Technical detail (CNAME, A record, TTL) is never shown unless the user explicitly asks for it. If the user is technical and wants the raw DNS instructions, a "Show technical details" affordance provides them.

### The Trust Score · public composite of verifiable facts

Every business page displays a public Trust Score composed of verifiable facts, not hidden signals. The components are:

- Identity Verified
- Email Verified
- Phone Verified
- Business Verified
- VAT Verified (where applicable to the country)
- Company Registration Verified
- Insurance Verified
- Trade Licence Verified (where applicable to the trade)
- DBS / Working With Children (where applicable to the business type)
- Public Reviews

The overall score (e.g., 98%) is expressed as a composite of these components. Each component is clickable to show what evidence supports it and when it was last verified. Opaque scores are prohibited; every score is explainable.

### The Digital Identity Score · private coaching metric

Distinct from the public Trust Score, the Digital Identity Score is a private coaching metric shown to the business owner. It breaks down as:

- Website
- SEO
- Business Information
- Reviews
- Photos
- Verification
- Speed
- Security
- Portfolio · Products · AI Knowledge · Response Time

The owner sees an overall score (e.g., 91/100) with per-component breakdown. Below the score, NEX becomes the coach: *"Your Digital Identity Score is 68. Completing these five tasks could raise it to 90+, making your business more complete and easier for customers to trust."* Each recommendation carries a "Why?" button that explains its reasoning.

The score is never shown publicly. Customers see the Trust Score (facts). Owners see the Digital Identity Score (coaching).

### The Digital Guardian · nightly automated monitoring

Every night NEX automatically checks each connected business for issues that could break its public presence:

- Domain expiry (with reminder cycles starting well before expiry)
- SSL certificate health (renewal handled where possible; owner notified when manual action is needed)
- DNS configuration (misconfiguration detection with plain-language guidance)
- Website availability (uptime monitoring)
- AI Business Assistant status
- Contact form functionality
- Booking system health
- Search indexing status
- Broken links
- Security issues
- Performance

The result is a morning summary: *"Your Digital Business is Healthy: 98/100. I found one issue — your contact page has a broken link. Would you like me to help fix it?"* One tap fixes the issue where possible; otherwise the owner is guided through the resolution.

### The Smart Routing Engine · never break a link

The `asknex.app` domain is a NEX brand asset. Broken or abandoned business pages reflect on the platform, not just the individual business. The Smart Routing Engine ensures visitors never encounter raw error messages.

**Absolute rules — never display to a visitor:**
- 404 Not Found
- 500 Server Error
- Account Suspended
- Hosting Expired
- Subscription Cancelled
- Payment Failed

**Instead, always display a professional state:**
- If the custom domain lapses but the NEX profile is active → automatic graceful redirect to the NEX Address
- If the NEX profile is inactive but the business is not archived → *"This website is temporarily unavailable"* professional page
- If the business is archived → *"This business is no longer trading"* page with an optional "Find Similar Businesses" button (visitor must click it — never automatic hijack)
- Under no circumstance is a visitor sent to the Trade Centre without their explicit click

### Reserved Names Protection

Certain names are reserved from reservation regardless of availability, to protect platform integrity, prevent impersonation, and preserve neutral utility paths. These include:

`admin` · `support` · `nex` · `official` · `finance` · `billing` · `chat` · `news` · `government` · `login` · `signup` · `settings` · `help` · `about` · `contact` · `terms` · `privacy` · `api` · `status` · `system`.

If a business's name would collide with a reserved word, NEX suggests variants.

### The Business Passport · one-page identity summary

Every business has a `Business Passport` — a single page containing everything that identifies and verifies the business. It includes: Owner, Business Name, Verification, Insurance, VAT, Company Number, Trade Licences, Reviews, Portfolio, Certificates, Products, Employees, Training, Compliance, and Website.

The purpose of the Business Passport is to give a customer, architect, procurement officer, or partner one link that fully identifies the business. Instead of navigating multiple pages, the enquirer sees one authoritative summary.

### Composition with the Business Brain

Every business account also maintains its own private Business Brain — a per-business AI knowledge accumulation that learns products, customers, suppliers, pricing, and writing style over years. The Digital Identity is what makes the Business Brain addressable; the Business Brain is what makes the Digital Identity intelligent. The two are complementary. See the sibling record *NEX Business Brain* for details.

---

## Advantages

- **Working public presence from day one.** No "build a website" hurdle. The NEX Address is live from the first minute of the account.
- **Permanent shareable link.** QR codes, invoices, business cards, and SEO citations remain valid for the lifetime of the account.
- **Country-scoped by design.** No name collisions across markets.
- **Identity survives rebranding.** Business name, logo, and custom domain can change without losing followers or reviews.
- **No lock-in on domain ownership.** The custom domain belongs to the business through its registrar. NEX only manages the connection.
- **Trust signals are verifiable.** Trust Score is a composite of facts, not opaque signals.
- **Ongoing automated protection.** Digital Guardian monitors expiries, SSL health, and availability nightly.
- **Every question about public presence is answered in one place.** The Digital Identity Centre eliminates the "which settings page controls this?" confusion.
- **AI Domain Assistant removes DNS complexity.** Owners without technical background can connect custom domains without learning CNAME records.
- **Compatible with future features.** Every future NEX product (payments, marketing intelligence, verification, marketplace listings) plugs into the same identity substrate.

## Disadvantages · Considerations

- **A NEX Address on `asknex.app` is not the same as a fully self-owned domain.** Businesses that want maximum brand independence should connect a custom domain, at additional cost.
- **Custom domain requires an active subscription that includes hosting.** If a subscription lapses to a plan that does not include hosting, the custom domain connection may be paused until reactivation.
- **Some verification checks are country-specific.** VAT verification, Company Registration verification, and Trade Licence verification are subject to the country and trade type of the business.
- **Reserved names cannot be claimed.** Certain terms are reserved to protect platform integrity; the business must choose a variant.
- **A rebrand changes the branding layer but not the NEX Address.** Businesses that want a new NEX Address after a rebrand should contact support to understand the options; automatic NEX Address swaps are not supported.

## Common Mistakes

- **Assuming the NEX Address is a website builder step to be completed later.** It is live from signup. Customers can be sent to it on day one.
- **Buying a custom domain before setting up the NEX account.** Not a problem, but many businesses buy a domain, sit with it unused for months, and then hit onboarding — the reverse order works fine but delays value.
- **Confusing the public Handle with the NEX ID.** The public handle (`@oakstairs`) is a branding attribute and may be changed. The NEX ID is internal and permanent.
- **Sharing the internal NEX ID publicly.** The NEX ID is intended for internal use. The public share link is the NEX Address (`asknex.app/uk/oakstairs`).
- **Expecting to bypass DNS by hosting elsewhere.** If a custom domain is used, its DNS must point to NEX. NEX cannot manage a business page when the DNS points to another host.
- **Cancelling a subscription and expecting the custom domain to keep resolving to the NEX page.** If the plan no longer includes hosting, the custom domain connection may be paused; the NEX Address continues to work.

## Setup Notes

The Digital Identity is created automatically at signup. No manual setup is required for the NEX ID or the NEX Address. Custom domain connection is a separate, optional step guided by the AI Domain Assistant. Verification checks are opt-in per component; the owner chooses which verification steps to complete and when.

## Maintenance

- Verification refresh: some verification components (e.g., insurance) may need periodic re-verification. NEX will remind the owner before a component expires.
- Custom domain renewal: the business is responsible for renewing the domain registration with its registrar. NEX will remind the owner before expiry.
- SSL certificates are renewed automatically where supported. Manual action is required only if the domain registrar changes DNS providers mid-cycle.
- The Digital Guardian handles routine health checks. Owner intervention is required only when the Guardian escalates an issue.

## Search Keywords

nex digital identity, nex id, nex address, custom domain, business page, business profile, digital identity centre, digital identity center, trust score, digital identity score, digital guardian, smart routing, business passport, ai domain assistant, asknex.app, domain connection, dns setup, ssl, https, business page url, permanent business address, business handle, business name change, business rebrand, business brand transfer, verification, trust signals, business verified

---

## Concepts

### Industry Knowledge

The following terms and mechanisms are established industry practice, not NEX-specific. They are referenced by this record but not owned by it; they can be updated in shared industry-knowledge records without touching this record.

- **Domain name** — a human-readable web address (e.g., `oakstairs.co.uk`) registered through a domain registrar and used to identify a specific location on the internet.
- **Domain registrar** — a company (e.g., GoDaddy, Cloudflare, Namecheap, IONOS) accredited to sell and administer domain registrations.
- **DNS (Domain Name System)** — the internet's directory service that translates human-readable domain names into numeric IP addresses.
- **CNAME record** — a DNS record type that maps one domain name to another (e.g., pointing `www.oakstairs.co.uk` to `connect.asknex.app`).
- **A record** — a DNS record type that maps a domain name directly to an IP address.
- **SSL / TLS** — cryptographic protocols that secure the connection between a browser and a server, enabling HTTPS.
- **HTTPS** — the secure form of the HTTP protocol used to serve web pages over an encrypted connection.
- **Web hosting** — the service of storing website files on a server accessible to the internet.
- **Domain extension (TLD)** — the top-level part of a domain (e.g., `.co.uk`, `.ie`, `.com.au`, `.com`) that often signals geography or purpose.
- **Domain expiry** — the date at which a domain registration must be renewed with the registrar to remain active.
- **Sitemap / robots.txt** — files that describe website structure and crawl policy to search engines.

### NEX Concepts

The following are NEX-proprietary concepts that this record is the canonical owner of. Changes to these definitions require Constitutional supersession.

- **NEX ID** — the internal permanent identifier (`NX-8F2K91XA`) issued to every business account; never exposed in public UI unless explicitly needed.
- **NEX Address** — the country-scoped permanent public URL (`asknex.app/uk/oakstairs`) issued to every business account at signup, free forever, and canonically shareable.
- **Digital Identity Centre** — the side-drawer surface (`🌐 My Digital Identity`) that consolidates every setting and view of the business's public presence into one location.
- **AI Domain Assistant** — the conversational flow that guides plain-language DNS configuration adapted per registrar.
- **Trust Score** — the public composite of verifiable facts displayed on the business page.
- **Digital Identity Score** — the private coaching metric shown to the owner with per-component breakdown and improvement guidance.
- **Digital Guardian** — the nightly automated monitoring service that checks domain expiry, SSL, DNS, availability, AI status, and broken links.
- **Smart Routing Engine** — the platform component that ensures visitors never see 404 / 500 / hosting-expired errors; always displays a professional state.
- **Business Passport** — the one-page identity summary that consolidates verification, insurance, registration, licences, reviews, and portfolio into one canonical link.
- **Public Handle** — the Instagram-style unique handle (`@oakstairs`) that identifies the business publicly; changeable subject to reservation policy.
- **Reserved Names** — the list of protected terms that cannot be claimed as public handles or NEX Address paths.

---

## Claims (Structured with Evidence)

Each substantive claim in this record carries an explicit classification, confidence, source_type, verification_date, and rationale, per Constitutional Clause 2.

- claim: "Domain names are the standard method for human-readable web addressing."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "ICANN · IETF RFC 1034/1035 (Domain Name System)"
  verification_date: 2026-08-06
  rationale: "The DNS is the internet's foundational addressing layer; no serious alternative exists at scale."

- claim: "SSL/TLS is required for modern browser HTTPS connections and search engine trust signals."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Chrome and major browser security warnings for non-HTTPS since 2018"
  verification_date: 2026-08-06
  rationale: "All major browsers and search engines flag non-HTTPS sites; HTTPS is de facto required for public business websites."

- claim: "NEX ID is the internal permanent identifier for every business account and takes the form NX-<hash>."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · NEX Digital Identity architecture (this session)"
  verification_date: 2026-08-06
  rationale: "Defined by Philip in the architecture directive on 2026-08-05; canonical statement of the NEX ID contract."

- claim: "NEX Address takes the form asknex.app/<country>/<handle> and is country-scoped by design."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05"
  verification_date: 2026-08-06
  rationale: "Country scoping resolves the multi-jurisdiction name collision problem structurally; the design was authored by Philip on 2026-08-05."

- claim: "The NEX Address is free at signup and works forever, barring account closure or policy violation."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · framing shift 'Your NEX Business Page is already live'"
  verification_date: 2026-08-06
  rationale: "Free permanence is central to the onboarding value proposition; any change would supersede the framing shift and require Constitutional review."

- claim: "Identity attributes (NEX ID, NEX Address) and branding attributes (Public Name, logo, Custom Domain) are deliberately separated so that a rebrand does not fragment the underlying record."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · 'I'd separate identity from branding'"
  verification_date: 2026-08-06
  rationale: "The separation is architectural and load-bearing; without it, a business that rebrands loses history."

- claim: "Custom domain ownership belongs to the business through its registrar. NEX only manages the connection between the domain and the NEX Business Page."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · 'Your domain belongs to you through your domain registrar'"
  verification_date: 2026-08-06
  rationale: "Explicit non-lock-in commitment; NEX does not take domain ownership."

- claim: "SSL is enabled automatically for supported custom domains once DNS is correctly configured."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · custom domain flow"
  verification_date: 2026-08-06
  rationale: "SSL auto-provisioning is a standard practice on modern platforms; NEX inherits this expectation."

- claim: "The Trust Score is a composite of verifiable facts; opaque scores are prohibited."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · 'never use opaque secret scores'"
  verification_date: 2026-08-06
  rationale: "Composability and explainability of trust signals is a Constitutional-level commitment (composes with the WHY button rule)."

- claim: "The Digital Identity Score is a private coaching metric, distinct from the public Trust Score."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · Digital Identity Score section"
  verification_date: 2026-08-06
  rationale: "The two-score design separates public trust signals from private coaching guidance; both are useful, but for different audiences."

- claim: "The Smart Routing Engine never displays 404, 500, Account Suspended, Hosting Expired, Subscription Cancelled, or Payment Failed pages to visitors."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · Smart Routing Engine · absolute rules"
  verification_date: 2026-08-06
  rationale: "Brand integrity is a Constitutional-level commitment; visitors are shown a professional state or a graceful redirect, never a raw error."

- claim: "Reserved names include admin, support, nex, official, finance, billing, chat, news, government, login, signup, settings, help, about, contact, terms, privacy, api, status, system."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Philip 2026-08-05 · initial reserved list; extensible"
  verification_date: 2026-08-06
  rationale: "The reserved list protects platform integrity and prevents impersonation; the list is initial and may grow."

---

## Relationships (Typed Graph Edges · Constitutional Clause 6)

```yaml
part_of:
  - business_nex_operating_system

composes_with:
  - business_nex_business_brain           # per-business AI companion
  - business_nex_business_passport        # identity summary artifact
  - business_nex_trust_score              # public trust composite
  - business_nex_smart_routing_engine     # link stability infrastructure
  - business_nex_digital_guardian         # nightly monitoring service

extends:
  - business_nex_signup_onboarding        # signup flow that issues the identity

referenced_by:
  - business_nex_trade_centre_listing     # marketplace listings inherit identity
  - business_nex_marketing_intelligence   # attribution keyed to identity
  - business_nex_payment_centre           # payment provider connections keyed to identity
  - business_nex_ceo_dashboard            # daily briefing scoped to identity

references:
  - industry_domain_name_system           # DNS industry knowledge (shared)
  - industry_ssl_tls_https                # SSL/TLS/HTTPS industry knowledge (shared)
  - industry_domain_registrars            # registrar landscape industry knowledge (shared)

audience_variants:
  homeowner_version: null                 # to be authored — customer-facing perspective on Business Profiles
  engineer_version: null                  # to be authored — technical detail on DNS + SSL + identity infrastructure

specialist_brains_that_consume:
  - business_brain
  - trust_brain
  - onboarding_brain
  - digital_presence_brain
```

---

## Canonical Q&A (Preserved Verbatim · Constitutional Clause 7)

The following canonical NEX-voice answers are preserved verbatim from the source authorship on 2026-08-05. When the Master Aggregator encounters a matching question, it reuses this wording to preserve voice consistency; when the question does not match, it composes a fresh answer from the Structured Knowledge above using the same tone principles.

**Q1 · What is my NEX Address?**
A: Your NEX Address is your permanent public business page. People can use it to contact you, view your business, leave reviews, request quotations, book services, chat with your AI assistant, browse your portfolio, and find your products.

**Q2 · Can I change my NEX Address?**
A: Your NEX Address is intended to remain permanent so that links, QR codes, reviews, and search engine results continue to work reliably. If you rebrand your business, you can update your business name and connect a new custom domain while keeping your NEX Address active. Where appropriate, NEX may support aliases or redirects.

**Q3 · Can I connect my own domain?**
A: Yes. Examples: oakstairs.co.uk, oakstairs.ie, oakstairs.com.au, oakstairs.com. NEX will continue to manage your content while visitors use your own domain.

**Q4 · Do I need a website?**
A: No. Every business receives a professional NEX Business Page automatically. You can use it immediately or connect your own domain later.

**Q5 · Will Google find my page?**
A: If your profile is public and search indexing is enabled, search engines can discover your public business page.

**Q6 · Can I hide my page?**
A: Yes. You control who can see your business. Visibility options include: Public, Customers Only, Private, Hidden.

**Q7 · What if someone has the same business name?**
A: Businesses are uniquely identified by their NEX Address and country. Example: asknex.app/uk/oakstairs and asknex.app/ie/oakstairs. Both businesses can exist independently.

**Q8 · Can I reserve my business name?**
A: Yes. Once your account is created, your NEX Address is reserved for your business while your account remains active under the platform's policies.

**Q9 · Can I transfer my NEX Address?**
A: Business ownership transfers may be supported through an authorised ownership transfer process, helping preserve reviews, portfolio items, and history where appropriate.

**Q10 · What if I close my business?**
A: You can archive your business. Your NEX Address won't immediately become available to someone else. NEX can retain it for a defined period to help prevent impersonation and protect existing links.

**Q11 · What is a domain name?**
A: A domain name is your business's web address on the internet. For example: oakstairs.co.uk, smithplumbing.ie, beautystudio.com.au. Customers use it to visit your website.

**Q12 · Do I need my own domain?**
A: No. Every business receives a free NEX Business Address, such as: asknex.app/uk/oakstairs. You can start using this immediately and connect your own domain whenever you're ready.

**Q13 · What's my business address?**
A: Your permanent NEX Business Address is: asknex.app/uk/oakstairs. You can share this with customers today.

**Q14 · Will my NEX address change?**
A: No. Your NEX Business Address is designed to remain permanent so your links, QR codes, reviews, and search engine listings continue to work over time.

**Q15 · Can I connect my own website address?**
A: Yes. Whenever you're ready, you can connect your own domain while keeping your NEX Business Address active.

**Q16 · Should I use my NEX address or my own domain?**
A: Both work well. Many businesses begin with their free NEX address and later connect their own domain as their business grows.

**Q17 · If I connect my domain, what happens?**
A: Nothing is lost. Your NEX address remains available and can continue working in the background while customers use your custom domain.

**Q18 · Do I need hosting?**
A: No. If you're using your NEX Business Page, hosting is included. You only need to own the domain name.

**Q19 · I'm not technical.**
A: That's perfectly fine. NEX guides you through every step using plain English.

**Q20 · Can you do it for me?**
A: Yes. I'll guide you through connecting your domain and verify when everything is working correctly.

**Q21 · What does DNS mean?**
A: DNS tells the internet where your domain should send visitors. NEX will explain exactly what needs to be updated and check your settings once you've made the changes.

**Q22 · What's SSL?**
A: SSL secures your website and allows visitors to use HTTPS. NEX enables secure connections for supported custom domains once they're configured correctly.

**Q23 · Is my site protected?**
A: Yes. NEX checks your website's security status and alerts you if something needs attention.

**Q24 · I use info@mybusiness.co.uk.**
A: Connecting your domain doesn't necessarily affect your business email, but it depends on how your domain is currently configured. NEX will check your settings and explain any changes before they're made.

**Q25 · What if I change my mind?**
A: You can disconnect your custom domain at any time. Your NEX Business Address will continue to work.

**Q26 · Will you remind me?**
A: Yes. If you've connected your domain, NEX can remind you before its registration expires so you can renew it in time.

**Q27 · Will you check if it's working?**
A: Yes. NEX can monitor your connected website and let you know if it appears to be unavailable or if there are issues requiring your attention.

**Q28 · Can someone take my NEX address?**
A: Your NEX Business Address is reserved for your account. Different businesses can have similar names in different countries, but each NEX Address remains unique.

**Q29 · Will it always work?**
A: As long as your account remains active and complies with NEX's terms, your permanent NEX Business Address is intended to remain available.

**Q30 · What's the advantage?**
A: Your NEX Business Page isn't just a website. It's connected to your AI Business Assistant, Bookings, Quotations, Reviews, Portfolio, Products, Customer enquiries, and Business profile. Everything works together, so you don't need separate systems for each part of your online presence.

---

## Related Records

Records to be authored next, referenced by the graph edges above:

- **business_nex_business_brain** — the per-business private AI companion
- **business_nex_business_passport** — the one-page identity summary
- **business_nex_trust_score** — the public trust composite (deep dive)
- **business_nex_digital_guardian** — nightly automated monitoring (deep dive)
- **business_nex_smart_routing_engine** — link stability infrastructure (deep dive)
- **business_nex_ai_domain_assistant** — DNS conversational flow (deep dive)
- **business_nex_ceo_dashboard** — daily conversational briefing
- **business_nex_digital_twin** — the 5-year outcome of accumulated Business Brain
- **industry_domain_name_system** — DNS industry knowledge (shared across records)
- **industry_ssl_tls_https** — SSL/TLS/HTTPS industry knowledge (shared)
- **industry_domain_registrars** — domain registrar landscape (shared)
- **business_nex_signup_onboarding** — the signup flow that issues the identity

Audience variants to be authored:

- **business_nex_digital_identity_homeowner_v1** — customer-facing perspective ("what is a Business Profile on NEX and what can I do with it?")
- **business_nex_digital_identity_engineer_v1** — technical detail (DNS, SSL, identity infrastructure)
