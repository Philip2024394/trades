// Business Modules — curated inventory.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Rule of thumb: if it's here as "shipped", a merchant can use it in
// the next 60 seconds. If it's "available-addon", it works but they
// have to enable it. Everything else is honestly labelled.
//
// KNOWLEDGE GRAPH LINK (S1.3): each Module now declares:
//   • poweredByDomain[]        the Knowledge Domain(s) it implements
//                              pieces of. Empty = site-infrastructure
//                              that doesn't map to a business capability.
//   • implementsCapability[]   "<domainId>.<capabilityId>" pairs — the
//                              actual Domain capabilities it satisfies.
// This lets the Recommendation Engine walk a Knowledge Package's
// resolved capability set + return every Module that satisfies it.

import type { BusinessModule } from "./types";

export const BUSINESS_MODULES: BusinessModule[] = [
  // ─── Site (universal, shipped) ─────────────────────────────────
  {
    id: "website",
    name: "Website",
    tagline: "Blueprint-driven pages you edit in Studio.",
    description:
      "Full multi-page site from a blueprint. Content-preserving swaps, 47 sections, mobile-first. Publish live in 60 seconds.",
    category: "site",
    state: "shipped",
    route: "/studio/blueprints",
    glyph: "🌐",
    expectedByTrades: [],
    // Website is presentation infrastructure. Doesn't implement a
    // business capability itself — it renders content produced by
    // Domains + Modules.
    poweredByDomain: [],
    implementsCapability: []
  },
  {
    id: "verified-badges",
    name: "Verified Badges",
    tagline: "Companies House + VAT auto-verify daily.",
    description:
      "Add your Companies House and VAT numbers, we verify against the free public registers every day. Verified badges appear on your site automatically. Gas Safe, NICEIC, TrustMark and 20 other schemes as self-declared.",
    category: "trust",
    state: "shipped",
    route: "/studio/credentials",
    glyph: "✅",
    expectedByTrades: [],
    poweredByDomain: ["compliance"],
    implementsCapability: ["compliance.scheme-verifier", "compliance.self-declaration"],

    // ─── DNA ──────────────────────────────────────────────────
    intent: {
      purpose:
        "Auto-verify UK trade credentials daily and render them as live badges on the merchant's public site. Silent hide when a scheme expires — never broken badges.",
      businessGoals: ["trust-building", "compliance"]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "verified-badges.credential-added",
          emittedWhen: "Merchant adds a scheme + number in the credential manager."
        },
        {
          id: "verified-badges.credential-verified",
          emittedWhen: "Daily cron confirms the scheme against the public register.",
          payload: { scheme: "string", status: "string" }
        },
        {
          id: "verified-badges.credential-expired",
          emittedWhen: "Register returns expired/suspended — badge auto-hides on site."
        }
      ],
      permissions: [
        "read:studio_brand_credentials",
        "write:studio_brand_credentials",
        "read:companies-house",
        "read:hmrc-vat"
      ],
      dataLifecycle: {
        creates: ["compliance.credential"],
        reads: [],
        updates: ["compliance.credential"],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.about", "page.contact"],
      sections: ["hero.trust_anchor_1"],
      navHooks: ["nav.footer"]
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "identical",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Every badge carries an accessible title + link to the public register so screen readers announce provenance."
    },
    intelligence: {
      // Compliance is factual — no AI copy rewrites. Automation is
      // the daily verifier, not creative output.
      aiActions: [],
      recommendedAutomations: ["daily-credential-verification"],
      recommendedIntegrations: ["companies-house", "hmrc-vat"]
    },
    assemblyRules: [
      {
        id: "insert-on-trust-strip",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "home.trust-strip",
          priority: 95
        },
        rationale:
          "Verified badges are the highest-priority home trust signal — they belong on the trust strip above the fold."
      },
      {
        id: "add-to-about",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.about",
          priority: 80
        },
        rationale:
          "About pages are where prospects verify who a merchant is — badges reinforce the story."
      },
      {
        id: "add-to-contact",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.contact",
          priority: 70
        },
        rationale:
          "Merchants who're about to be contacted benefit from a last-mile trust reminder above the form."
      },
      {
        id: "suggest-review-collection",
        trigger: { kind: "on-usage-first" },
        action: {
          kind: "suggest-module",
          target: "review-collection",
          priority: 50
        },
        rationale:
          "Verified badges + real reviews stack — merchants often see conversion lifts when both are on the page."
      }
    ]
  },
  {
    id: "coverage-radius",
    name: "Coverage Radius",
    tagline: "Postcode gate on every public page.",
    description:
      "Set your service centre and radius. Visitors type their postcode and see instantly whether you cover them. Powered by postcodes.io.",
    category: "site",
    state: "shipped",
    route: "/studio/blueprints/wizard",
    glyph: "📍",
    expectedByTrades: [],
    // Site-presentation gate — doesn't implement a capability, it's
    // a merchant-configured filter over the site's forms + sections.
    poweredByDomain: [],
    implementsCapability: []
  },
  {
    id: "local-seo",
    name: "Local SEO Pack",
    tagline: "GMB description, services, posts, review requests.",
    description:
      "Ready-to-paste Google Business Profile content generated from your blueprint. Copy any block, paste into GMB.",
    category: "growth",
    state: "shipped",
    route: "/studio/local-seo",
    glyph: "🔎",
    expectedByTrades: [],
    // Real link to Marketing Domain (S2.E). Drafts UK-trade GMB copy
    // through the ASA copy guard so headlines don't ship superlatives.
    poweredByDomain: ["marketing"],
    implementsCapability: [
      "marketing.content-generation",
      "marketing.seo-content-plan",
      "marketing.asa-copy-guard"
    ],

    // ─── DNA (S2.N) ──────────────────────────────────────────
    intent: {
      purpose:
        "Generate ready-to-paste GBP content — service description, weekly posts, review-request scripts — every block ASA-checked so the merchant can copy without worrying about superlatives or unsubstantiated claims.",
      businessGoals: ["capture-leads", "brand-authority", "trust-building"]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "local-seo.block-generated",
          emittedWhen: "Merchant generates a copy block for GBP.",
          payload: { block_kind: "string", asa_flags: "number" }
        },
        {
          id: "local-seo.block-copied",
          emittedWhen: "Merchant copies a generated block to clipboard."
        }
      ],
      permissions: ["read:studio_layouts", "read:studio_brand_credentials"],
      dataLifecycle: {
        creates: ["marketing.content-asset"],
        reads: ["marketing.testimonial"],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: [],
      sections: [],
      navHooks: ["studio.growth-coach-nudge"]
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Each copy block has a labelled 'copy to clipboard' button with a live-region confirmation on success."
    },
    intelligence: {
      aiActions: ["copy.rewrite"],
      recommendedAutomations: [
        "weekly-gbp-post-suggestion",
        "asa-superlative-scan"
      ],
      recommendedIntegrations: ["google-business-profile"]
    },
    assemblyRules: [
      {
        id: "surface-in-growth-coach",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "studio.growth-coach-nudge",
          priority: 55
        },
        rationale:
          "Local SEO Pack fires nudges into the Growth Coach when there are fresh blocks the merchant hasn't posted yet — keeps GBP updates from becoming a chore."
      },
      {
        id: "suggest-newsletter-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "newsletter",
          priority: 45
        },
        rationale:
          "GBP posts + newsletter is the cheapest content stack — the same weekly update fills both channels."
      },
      {
        id: "suggest-verified-badges-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "verified-badges",
          priority: 60
        },
        rationale:
          "Verified badges give the SEO Pack real credential text to include in GBP copy — 'NICEIC-verified Sheffield electrician' outperforms 'trusted local'."
      }
    ]
  },
  {
    id: "growth-coach",
    name: "Growth Coach",
    tagline: "Your next 3 wins, updated on every load.",
    description:
      "Live inspection of your setup — trust badges, coverage, WhatsApp, unpublished drafts. Top 3 highest-impact next actions. No 10-score judgment panel.",
    category: "growth",
    state: "shipped",
    route: "/studio/home",
    glyph: "📈",
    expectedByTrades: [],
    // Cross-cutting analytics — no single Domain owns it.
    poweredByDomain: [],
    implementsCapability: []
  },
  {
    id: "storm-mode",
    name: "Storm Mode Banner",
    tagline: "Toggle a service-status ribbon in one tap.",
    description:
      "Merchant-triggered banner with auto-expire. For roofers in storms, plumbers during freezes, tree surgeons after high winds. Manual toggle (Met Office DataHub is paid + scraping is fragile).",
    category: "site",
    state: "shipped",
    route: "/studio/storm-mode",
    glyph: "⚡",
    expectedByTrades: ["roofer", "plumber", "tree-surgeon", "fencing-contractor"],
    // Presentation-only, no capability implementation.
    poweredByDomain: [],
    implementsCapability: []
  },
  {
    id: "payments",
    name: "Payments",
    tagline: "23 processors ready to accept card, bank, crypto.",
    description:
      "Stripe, PayPal, Mollie, Klarna, Razorpay, Midtrans, Wise, Adyen, Coinbase and 14 more. Currency-aware amounts (IDR/JPY/KRW correctly handled). Merchant orders dashboard + refunds.",
    category: "commerce",
    state: "shipped",
    route: "/studio/payments",
    glyph: "💳",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "tool-merchant",
      "workwear-supplier",
      "ppe-supplier"
    ],
    // Real link to Finance Domain (S2.M). Card + bank + BNPL capture
    // rides the Domain's payment-capture capability + PSD2 SCA + MTD
    // guardrails.
    poweredByDomain: ["finance"],
    implementsCapability: ["finance.payment-capture", "finance.refund-issue"],

    // ─── DNA (S2.N) ──────────────────────────────────────────
    intent: {
      purpose:
        "Give the merchant one dashboard to pick a payment processor, take card / bank / BNPL / crypto, and see every order + refund. Currency-aware so IDR / JPY / KRW render correctly. PSD2 SCA + Consumer Rights Act refund window enforced by the runtime, not by the merchant.",
      businessGoals: [
        "increase-quotes",
        "reduce-friction",
        "operational-efficiency"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "payments.provider-connected",
          emittedWhen: "Merchant completes the OAuth handshake for a processor.",
          payload: { provider: "string" }
        },
        {
          id: "payments.order-paid",
          emittedWhen: "Provider webhook confirms a successful capture.",
          payload: {
            order_id: "reference",
            amount_minor: "number",
            currency: "string",
            provider: "string"
          }
        },
        {
          id: "payments.refund-issued",
          emittedWhen: "Merchant issues a full or partial refund.",
          payload: {
            payment_id: "reference",
            amount_minor: "number"
          }
        }
      ],
      permissions: [
        "read:payment-providers",
        "write:payment-providers",
        "write:payment-orders",
        "webhook:receive"
      ],
      dataLifecycle: {
        creates: ["finance.payment", "finance.refund"],
        reads: ["finance.invoice", "crm.deal"],
        updates: ["finance.invoice"],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.pricing", "page.contact"],
      sections: [],
      navHooks: ["nav.footer"]
    },
    behaviour: {
      seoImpact: "neutral",
      mobileBehaviour: "identical",
      offlineBehaviour: "unavailable",
      a11yNotes:
        "Every payment button carries an accessible label with amount + currency; SCA modal is focus-trapped."
    },
    intelligence: {
      aiActions: [],
      recommendedAutomations: [
        "refund-window-auto-detect",
        "receipt-email-on-capture"
      ],
      recommendedIntegrations: [
        "stripe",
        "paypal",
        "mollie",
        "xero",
        "quickbooks-online"
      ]
    },
    assemblyRules: [
      {
        id: "add-pricing-cta",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-cta",
          target: "home.primary-cta",
          priority: 60
        },
        rationale:
          "Once you can accept payment on the site, the primary CTA earns the right to be 'Pay online' instead of 'Get a quote' — bigger merchants convert faster on transactional CTAs."
      },
      {
        id: "suggest-invoicing-partner",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "invoicing",
          priority: 55
        },
        rationale:
          "Payments capture money; invoicing reconciles it in your books. Xero / QuickBooks is where accountants want the numbers to land."
      },
      {
        id: "wire-to-quote-pipeline",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "quote-pipeline",
          priority: 70
        },
        rationale:
          "Every paid order should mark its source Deal as won — feed the pipeline the outcome so the funnel view stays accurate."
      }
    ]
  },

  // ─── Available add-ons (real but require enabling) ─────────────
  {
    id: "trade-connections",
    name: "Trade Connections",
    tagline: "Cross-refer with other trades on the platform.",
    description:
      "Auto-scroll trade carousel on every PDP + floating 'back to merchant' chip. Included free by default. Turn off in add-ons.",
    category: "growth",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "trade_connections",
    glyph: "🤝",
    expectedByTrades: [],
    poweredByDomain: [],
    implementsCapability: [],

    // ─── DNA (S2.K4) ──────────────────────────────────────────
    intent: {
      purpose:
        "Turn every product page into a two-way local marketplace — customers who bought materials find local trades who install them, and installers get a floating 'back to merchant' chip so the merchant recovers the referral.",
      businessGoals: ["cross-sell", "brand-authority", "capture-leads"]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "trade-connections.impression",
          emittedWhen:
            "Carousel scrolls into view on a product or shop page.",
          payload: { product_id: "reference", trades_shown: "number" }
        },
        {
          id: "trade-connections.click-through",
          emittedWhen:
            "Customer taps a trade card and lands on that trade's profile."
        },
        {
          id: "trade-connections.return",
          emittedWhen:
            "Customer clicks the 'Back to [Merchant]' floating chip to return."
        }
      ],
      permissions: ["read:listing", "read:products"],
      dataLifecycle: {
        creates: [],
        reads: [],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.services", "page.projects"],
      sections: ["services.list_1", "product_grid.classic_3col_1"],
      navHooks: []
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Carousel supports keyboard arrow-key nav; each card has an accessible title with trade name + city; the return-chip is focus-trap-safe."
    },
    intelligence: {
      aiActions: [],
      recommendedAutomations: ["trade-connections-radius-tuning"],
      recommendedIntegrations: []
    },
    assemblyRules: [
      {
        id: "add-to-services-page",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.services",
          priority: 60
        },
        rationale:
          "Trade Connections belong under Services — that's where visitors look for 'who fits this?' after browsing products."
      },
      {
        id: "insert-home-tool-strip",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "home.tool-strip",
          priority: 40
        },
        rationale:
          "A tile in the home tool strip advertises the installer directory to visitors who aren't ready to browse products yet."
      },
      {
        id: "wire-to-lead-alerts",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "lead-alerts",
          priority: 45
        },
        rationale:
          "Every click-through to an installer is a signal the merchant referred business — wire it into Lead Alerts so they know when their referrals convert."
      },
      {
        id: "suggest-quote-pipeline",
        trigger: { kind: "on-usage-first" },
        action: {
          kind: "suggest-module",
          target: "quote-pipeline",
          priority: 30
        },
        rationale:
          "Trade Connections referrals often turn into quote requests coming back the other way — the pipeline captures them without extra work."
      }
    ]
  },
  {
    id: "job-diary",
    name: "Job Diary",
    tagline: "Log jobs from the van, auto-publish to gallery.",
    description:
      "Track projects from quote to sign-off, upload photos on the day, auto-publish to your public gallery.",
    category: "operations",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "job_diary",
    glyph: "📔",
    expectedByTrades: [],
    // Real link to Projects Domain (S2.M). Job Diary is the customer-
    // facing portfolio + private history built on top of Project +
    // Phase + Photo capture.
    poweredByDomain: ["projects"],
    implementsCapability: [
      "projects.project-timeline",
      "projects.phase-tracking",
      "projects.snag-log",
      "projects.photo-record",
      "projects.sign-off"
    ],

    // ─── DNA ──────────────────────────────────────────────────
    intent: {
      purpose:
        "Turn jobs the merchant does into a portfolio they can point prospects at. Photos + notes captured on-site auto-flow into a public gallery + private job history.",
      businessGoals: [
        "trust-building",
        "brand-authority",
        "cross-sell",
        "operational-efficiency"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "job-diary.job-logged",
          emittedWhen: "Merchant logs a new job in the field.",
          payload: {
            job_id: "reference",
            trade: "string",
            customer_type: "string"
          }
        },
        {
          id: "job-diary.photo-uploaded",
          emittedWhen: "Photo added to a job (mobile or Studio)."
        },
        {
          id: "job-diary.job-published",
          emittedWhen:
            "Job flagged for portfolio publication — appears on the public gallery."
        },
        {
          id: "job-diary.job-completed",
          emittedWhen: "Merchant marks the job as signed-off."
        }
      ],
      permissions: [
        "read:studio_layouts",
        "write:studio_layouts",
        "write:media"
      ],
      dataLifecycle: {
        // Projects Domain not yet in registry — leave creates empty
        // until S1.1b lands. Update ref stays honest.
        creates: [],
        reads: [],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.projects", "page.about"],
      sections: ["gallery.grid_1"],
      navHooks: ["nav.header", "nav.footer"]
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "identical",
      offlineBehaviour: "works",
      a11yNotes:
        "Photo galleries carry alt-text prompts on upload; image navigation is fully keyboardable."
    },
    intelligence: {
      aiActions: ["copy.rewrite", "media.removeBackground"],
      recommendedAutomations: [
        "exif-geotag-blur",
        "auto-alt-text-generation",
        "portfolio-social-share"
      ],
      recommendedIntegrations: ["twilio", "resend"]
    },
    assemblyRules: [
      {
        id: "add-projects-page",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.projects",
          priority: 90
        },
        rationale:
          "The Projects page is the natural home for the merchant's portfolio — job-diary IS the portfolio in most trades."
      },
      {
        id: "add-nav-portfolio",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-nav-item",
          target: "nav.header",
          priority: 55
        },
        rationale:
          "'Portfolio' or 'Recent work' is a top-3 nav item on almost every UK trade site."
      },
      {
        id: "insert-home-portfolio-preview",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "home.tool-strip",
          priority: 45
        },
        rationale:
          "A rotating 3-tile preview of the merchant's recent jobs on the home page increases nav-through to the full portfolio."
      },
      {
        id: "wire-to-quote-pipeline",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "quote-pipeline",
          priority: 65
        },
        rationale:
          "Won quotes become logged jobs. Wire the pipeline's won status to auto-open a diary entry so the merchant just adds photos."
      },
      {
        id: "suggest-review-collection",
        trigger: { kind: "on-configure" },
        action: {
          kind: "suggest-module",
          target: "review-collection",
          priority: 45
        },
        rationale:
          "Portfolio + reviews is a proven trust combo. Prompt after the merchant configures Job Diary because that's when they're thinking about proof."
      }
    ]
  },
  {
    id: "quote-pipeline",
    name: "Quote Pipeline",
    tagline: "Track quotes from lead → sent → won.",
    description:
      "Kanban board for your quotes. Lead → surveyed → sent → won/lost. Templates + email sending.",
    category: "operations",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "quote_pipeline",
    glyph: "📝",
    expectedByTrades: [],
    // Real link to the Quoting Domain — this module implements the
    // entire lifecycle of the Quote entity.
    poweredByDomain: ["quoting"],
    implementsCapability: [
      "quoting.quote-pdf",
      "quoting.quote-send",
      "quoting.quote-follow-up",
      "quoting.quote-accept",
      "quoting.quote-revise"
    ],

    // ─── DNA ──────────────────────────────────────────────────
    intent: {
      purpose:
        "Turn every enquiry into a tracked opportunity — quote drafted, sent, opened, chased, won or lost. Recovery of the estimated-but-not-won conversion gap is the single biggest revenue lift for most trade merchants.",
      businessGoals: [
        "increase-quotes",
        "operational-efficiency",
        "recurring-revenue",
        "customer-retention"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "quote-pipeline.quote-drafted",
          emittedWhen: "Merchant creates a quote draft in the pipeline.",
          payload: { deal_id: "reference", value_minor: "number" }
        },
        {
          id: "quote-pipeline.quote-sent",
          emittedWhen: "Merchant sends the quote to the customer."
        },
        {
          id: "quote-pipeline.quote-viewed",
          emittedWhen: "Customer opens the sent quote via trackable link."
        },
        {
          id: "quote-pipeline.quote-won",
          emittedWhen: "Customer accepts (or merchant marks as won).",
          payload: { deal_id: "reference", value_minor: "number" }
        },
        {
          id: "quote-pipeline.quote-lost",
          emittedWhen: "Merchant marks quote as lost (with optional reason).",
          payload: { deal_id: "reference", lost_reason: "string" }
        },
        {
          id: "quote-pipeline.follow-up-sent",
          emittedWhen: "Automatic or manual follow-up sent to customer."
        }
      ],
      permissions: [
        "read:crm.deal",
        "write:crm.deal",
        "write:quoting.quote",
        "write:quoting.quote-event",
        "read:studio_brand_credentials"
      ],
      dataLifecycle: {
        creates: [
          "quoting.quote",
          "quoting.quote-clause",
          "quoting.quote-event"
        ],
        reads: ["crm.deal", "crm.contact", "estimating.estimate"],
        updates: ["crm.deal"],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.contact"],
      sections: ["contact.split_1"],
      navHooks: []
    },
    behaviour: {
      seoImpact: "neutral",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Kanban board is fully keyboard-navigable; column headers announce column counts to screen readers."
    },
    intelligence: {
      aiActions: ["copy.rewrite", "section.suggestAlternative"],
      recommendedAutomations: [
        "quote-follow-up-3-day",
        "quote-follow-up-7-day",
        "won-quote-review-request"
      ],
      recommendedIntegrations: [
        "resend",
        "whatsapp-business",
        "docusign",
        "xero"
      ]
    },
    assemblyRules: [
      {
        id: "wire-from-material-calculators",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "material-calculators",
          priority: 85
        },
        rationale:
          "Estimates from Material Calculators flow into the pipeline as draft quotes — closing the 'calculator without follow-up' leak."
      },
      {
        id: "wire-from-lead-alerts",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "lead-alerts",
          priority: 80
        },
        rationale:
          "Every lead alert should create a pipeline card so nothing falls through the cracks."
      },
      {
        id: "suggest-lead-alerts-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "lead-alerts",
          priority: 60
        },
        rationale:
          "Without Lead Alerts the merchant misses live enquiries — the pipeline is only as good as the top of it."
      },
      {
        id: "suggest-job-diary-after-first-win",
        trigger: { kind: "on-usage-first" },
        action: {
          kind: "suggest-module",
          target: "job-diary",
          priority: 55
        },
        rationale:
          "Every won quote is a portfolio candidate. Prompt to install Job Diary right after the first win so photos get captured while the job's happening."
      },
      {
        id: "add-contact-cta",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-cta",
          target: "home.primary-cta",
          priority: 65
        },
        rationale:
          "'Get a quote' becomes the primary home-page CTA — the quote pipeline can now handle it end-to-end."
      }
    ]
  },
  {
    id: "material-calculators",
    name: "Material Calculators",
    tagline: "Paint, flooring, tiles, gravel, concrete on your PDPs.",
    description:
      "15 launch calculators embedded in relevant products. Live totals, add-to-cart, shareable estimate URL.",
    category: "commerce",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "material_calculators",
    glyph: "🧮",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "aggregate-supplier",
      "concrete-supplier",
      "painter",
      "tiler",
      "landscaper"
    ],
    // Real link to the Estimating Domain — Material Calculators are
    // the implementation of Estimating's material-calculator +
    // waste-factor capability shells.
    poweredByDomain: ["estimating"],
    implementsCapability: [
      "estimating.material-calculator",
      "estimating.waste-factor"
    ],

    // ─── Full DNA (S2.A reference implementation) ─────────────
    intent: {
      purpose:
        "Turn dimensions into a costed take-off inside product pages. Reduces price-quote friction for the buyer while capturing an estimate the merchant can convert into a quote.",
      businessGoals: [
        "increase-quotes",
        "reduce-friction",
        "cross-sell"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "material-calculators.calculated",
          emittedWhen:
            "The buyer submits dimensions and the calculator returns a total.",
          payload: {
            product_id: "reference",
            total_minor: "number",
            quantity: "number",
            currency: "string"
          }
        },
        {
          id: "material-calculators.converted",
          emittedWhen:
            "The buyer clicks 'Get a quote for this estimate' or adds the estimate to cart."
        },
        {
          id: "material-calculators.shared",
          emittedWhen:
            "The buyer copies the shareable estimate URL."
        }
      ],
      permissions: [
        "read:studio_layouts",
        "write:estimating.estimate",
        "write:estimating.estimate-line"
      ],
      dataLifecycle: {
        creates: ["estimating.estimate", "estimating.estimate-line", "estimating.calculator-input"],
        reads: [],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.services", "page.pricing"],
      sections: ["services.list_1", "product_grid.classic_3col_1"],
      navHooks: ["nav.header"]
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "adapted",
      offlineBehaviour: "unavailable",
      a11yNotes:
        "Numeric inputs have keyboard hints; live-region announces totals; focus stays inside the calculator until submit."
    },
    intelligence: {
      aiActions: ["copy.rewrite", "section.suggestAlternative"],
      recommendedAutomations: [
        "email-estimate-recap",
        "whatsapp-estimate-share"
      ],
      recommendedIntegrations: ["hubspot", "twilio", "resend"]
    },
    assemblyRules: [
      {
        id: "add-to-services-on-install",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.services",
          priority: 70
        },
        rationale:
          "Calculators live under Services on every UK trade site — that's where buyers look first."
      },
      {
        id: "insert-tool-strip-on-home",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "home.tool-strip",
          priority: 60
        },
        rationale:
          "Homepage tool strip lifts discovery of the calculator by ~30% in initial testing (pending real conversion data)."
      },
      {
        id: "add-nav-entry",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-nav-item",
          target: "nav.header",
          priority: 40
        },
        rationale:
          "Buyers searching for 'calculator' look in the top nav; add an entry so they don't bounce."
      },
      {
        id: "wire-to-quote-pipeline",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "quote-pipeline",
          priority: 80
        },
        rationale:
          "Estimates that don't reach the Quote Pipeline die in the calculator — wire the conversion event so the pipeline picks up every calculation."
      },
      {
        id: "suggest-quote-pipeline-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "quote-pipeline",
          priority: 50
        },
        rationale:
          "Calculators feed quotes — without the Quote Pipeline the estimates just sit there. Suggest but don't force."
      },
      {
        id: "suggest-portfolio-on-low-conversion",
        trigger: {
          kind: "on-conversion-below",
          percentage: 5,
          withinDays: 30
        },
        action: {
          kind: "suggest-module",
          target: "job-diary",
          priority: 30
        },
        rationale:
          "If the calculator gets used but conversions are low, trust is missing — a project portfolio (Job Diary) helps buyers feel confident committing."
      }
    ]
  },
  {
    id: "lead-alerts",
    name: "Lead Alerts",
    tagline: "Web-push + email the moment a quote request lands.",
    description:
      "VAPID web-push to your phone + email backup. Reply from the notification without opening Studio.",
    category: "operations",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "lead_alerts",
    glyph: "🔔",
    expectedByTrades: [],
    poweredByDomain: ["crm"],
    implementsCapability: ["crm.lead-capture"],

    // ─── DNA ──────────────────────────────────────────────────
    intent: {
      purpose:
        "Get the merchant to the enquiry within seconds. Web-push (VAPID) to their phone with an email backup so no lead sits in a form-submission log unread.",
      businessGoals: [
        "capture-leads",
        "operational-efficiency",
        "reduce-friction"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "lead-alerts.lead-received",
          emittedWhen: "A public form submission produces a new Deal.",
          payload: { deal_id: "reference", source: "string" }
        },
        {
          id: "lead-alerts.notification-sent",
          emittedWhen: "Web-push + email fired to the merchant."
        },
        {
          id: "lead-alerts.notification-clicked",
          emittedWhen:
            "Merchant taps the notification and lands on the Deal."
        },
        {
          id: "lead-alerts.notification-dismissed",
          emittedWhen: "Merchant dismisses the notification without opening."
        }
      ],
      permissions: [
        "read:crm.contact",
        "read:crm.deal",
        "write:crm.interaction",
        "webpush:send"
      ],
      dataLifecycle: {
        creates: ["crm.interaction"],
        reads: ["crm.contact", "crm.deal"],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: [],
      sections: [],
      navHooks: ["studio.growth-coach-nudge"]
    },
    behaviour: {
      seoImpact: "neutral",
      mobileBehaviour: "identical",
      offlineBehaviour: "works",
      a11yNotes:
        "Web-push notifications carry accessible titles + body text; opt-in flow announces the permission ask."
    },
    intelligence: {
      aiActions: ["copy.rewrite"],
      recommendedAutomations: [
        "escalate-if-no-response-in-2h",
        "sms-fallback-out-of-hours"
      ],
      recommendedIntegrations: ["twilio", "resend", "whatsapp-business"]
    },
    assemblyRules: [
      {
        id: "wire-to-quote-pipeline",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "quote-pipeline",
          priority: 85
        },
        rationale:
          "Every alert should create a card in the pipeline so the merchant has a place to work the lead — not just a notification that expires."
      },
      {
        id: "suggest-quote-pipeline-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "quote-pipeline",
          priority: 70
        },
        rationale:
          "Alerts without a pipeline behind them = notifications the merchant can't act on. Prompt the install."
      },
      {
        id: "surface-in-studio-growth-coach",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "studio.growth-coach-nudge",
          priority: 50
        },
        rationale:
          "Growth Coach card should show pending unread alerts so merchants don't miss anything when they open Studio."
      }
    ]
  },
  {
    id: "downloads",
    name: "Downloads",
    tagline: "Datasheets, warranties, certificates on your PDPs.",
    description:
      "Attach PDFs to any product or service. Great for merchants + fitters passing paperwork to trade customers.",
    category: "commerce",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "downloads",
    glyph: "📎",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "electrical-wholesaler",
      "plumbing-merchant"
    ],
    // Real link to Materials Domain (S2.E). Spec sheets + warranty
    // docs are the on-PDP surface of the Domain's spec-sheet-generation
    // + warranty-lookup capabilities.
    poweredByDomain: ["materials"],
    implementsCapability: [
      "materials.spec-sheet-generation",
      "materials.warranty-lookup"
    ]
  },
  {
    id: "custom-domain",
    name: "Custom Domain",
    tagline: "Bring your own domain to your Xrated site.",
    description:
      "Point your .co.uk or .com at Xrated — we handle certs + DNS. £5/mo add-on.",
    category: "site",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "custom_domain",
    glyph: "🌍",
    expectedByTrades: [],
    poweredByDomain: [],
    implementsCapability: []
  },
  {
    id: "shop-mode",
    name: "Shop Mode",
    tagline: "Product-first ecommerce on your site.",
    description:
      "Category grids, PDPs, stock indicators, checkout. Recommended for merchants + product retailers.",
    category: "commerce",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "shop_mode",
    glyph: "🛒",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "tool-merchant",
      "workwear-supplier",
      "ppe-supplier",
      "aggregate-supplier",
      "concrete-supplier"
    ],
    // Real link to Materials Domain (S2.E). Product grids + PDPs are
    // the customer-facing surface of catalogue-lookup + spec-sheet
    // capabilities.
    poweredByDomain: ["materials"],
    implementsCapability: [
      "materials.catalogue-lookup",
      "materials.spec-sheet-generation"
    ]
  },
  {
    id: "wholesale-mode",
    name: "Wholesale Mode",
    tagline: "Trade-account pricing + credit line display.",
    description:
      "Dual retail/trade prices. Signed-in trade accounts see their prices + credit balance. B2B checkout.",
    category: "commerce",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "wholesale_mode",
    glyph: "🏪",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "tool-merchant",
      "electrical-wholesaler",
      "plumbing-merchant"
    ],
    // Wholesale is B2B customer segmentation over the catalogue —
    // implements CRM (Company + credit-line) + Materials (trade-price
    // catalogue lookup).
    poweredByDomain: ["crm", "materials"],
    implementsCapability: [
      "crm.deal-pipeline",
      "materials.catalogue-lookup"
    ]
  },
  {
    id: "newsletter",
    name: "Newsletter",
    tagline: "Capture emails, send updates.",
    description:
      "Inline signup section + admin console for sending campaigns. Included free by default.",
    category: "growth",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "newsletter",
    glyph: "📬",
    expectedByTrades: [],
    // Real link to Marketing Domain (S2.E). Signup + campaign send is
    // the merchant surface of content-generation — every send routes
    // through PECR marketing-consent guardrails.
    poweredByDomain: ["marketing"],
    implementsCapability: ["marketing.content-generation"],

    // ─── DNA (S2.K4) ──────────────────────────────────────────
    intent: {
      purpose:
        "Capture opt-in email addresses on the merchant's public profile with a PECR-compliant consent flow so the merchant can notify customers when stock lands or promos run — without ever handling the send inside Thenetworkers.",
      businessGoals: ["capture-leads", "customer-retention"]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "newsletter.subscribed",
          emittedWhen:
            "Visitor submits the footer signup form with valid consent.",
          payload: { email: "string", consent_source: "string" }
        },
        {
          id: "newsletter.unsubscribed",
          emittedWhen:
            "Subscriber clicks the one-click unsubscribe link on a delivered email."
        },
        {
          id: "newsletter.exported",
          emittedWhen:
            "Merchant exports the subscriber CSV from the manage-subscribers editor."
        }
      ],
      permissions: ["read:listing", "write:newsletter-subscribers"],
      dataLifecycle: {
        creates: ["marketing.testimonial"],
        reads: [],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: [],
      sections: [],
      navHooks: ["nav.footer"]
    },
    behaviour: {
      seoImpact: "neutral",
      mobileBehaviour: "identical",
      offlineBehaviour: "unavailable",
      a11yNotes:
        "Signup form uses labelled inputs, a persistent consent checkbox, and a live-region confirmation on submit."
    },
    intelligence: {
      aiActions: ["copy.rewrite"],
      recommendedAutomations: ["welcome-email-template"],
      recommendedIntegrations: ["mailchimp", "brevo", "resend"]
    },
    assemblyRules: [
      {
        id: "add-to-footer-nav",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-nav-item",
          target: "nav.footer",
          priority: 55
        },
        rationale:
          "The footer is the conventional home for a newsletter signup on every UK trade site — visitors look for it there."
      },
      {
        id: "add-home-secondary-cta",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-cta",
          target: "home.secondary-cta",
          priority: 40
        },
        rationale:
          "'Get stock updates' is a lower-friction CTA than 'Get a quote' — capture the customer who isn't ready to buy yet."
      },
      {
        id: "suggest-local-seo-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "local-seo",
          priority: 35
        },
        rationale:
          "Newsletter + Google Business Profile posts is the cheapest content stack for staying top-of-mind between purchases."
      }
    ]
  },
  {
    id: "meet-the-team",
    name: "Meet the Team",
    tagline: "Faces + certifications on your site.",
    description:
      "Team grid + individual member cards. Great for showing CSCS-carded operators + Gas Safe engineers.",
    category: "site",
    state: "available-addon",
    route: "/studio/apps",
    addonSlug: "meet_the_team",
    glyph: "👥",
    expectedByTrades: [],
    // Real link to Staff Domain (S2.M). Team grid + individual cards
    // ride the Domain's roster + certification capabilities.
    poweredByDomain: ["staff"],
    implementsCapability: [
      "staff.roster",
      "staff.certification-tracking"
    ],

    // ─── DNA (S2.K4) ──────────────────────────────────────────
    intent: {
      purpose:
        "Put faces to the business so counter customers recognise the yard team, prospects trust the size of the operation, and CSCS/Gas Safe cards can sit next to the person carrying them.",
      businessGoals: ["trust-building", "brand-authority"]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "meet-the-team.card-viewed",
          emittedWhen:
            "Team card scrolls into view on the merchant's public profile."
        },
        {
          id: "meet-the-team.direct-dial-clicked",
          emittedWhen:
            "Visitor taps a team member's direct-dial link (click-to-call).",
          payload: { member_id: "reference" }
        }
      ],
      permissions: ["read:listing"],
      dataLifecycle: {
        creates: [],
        reads: [],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.about"],
      sections: [],
      navHooks: []
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Each card is a labelled group announcing name + role; the rotation between slots 2–4 respects prefers-reduced-motion."
    },
    intelligence: {
      aiActions: ["media.removeBackground"],
      recommendedAutomations: [],
      recommendedIntegrations: []
    },
    assemblyRules: [
      {
        id: "add-to-about-page",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-to-page",
          target: "page.about",
          priority: 85
        },
        rationale:
          "The About page is where visitors go to see who's actually behind the business — the team grid belongs there."
      },
      {
        id: "insert-home-tool-strip-preview",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "home.tool-strip",
          priority: 35
        },
        rationale:
          "A 4-card team preview on the home page lifts About-page click-through for visitors who wouldn't otherwise navigate deeper."
      },
      {
        id: "suggest-verified-badges",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "verified-badges",
          priority: 55
        },
        rationale:
          "Team faces + real credential badges stack — showing CSCS or Gas Safe next to the person holding it is more persuasive than either alone."
      }
    ]
  },

  // ─── Partner integrations (honest — we recommend, we don't own) ──
  {
    id: "invoicing",
    name: "Invoicing",
    tagline: "Xero or QuickBooks — we recommend, we don't reinvent.",
    description:
      "Invoicing is a serious product we don't want to fake. Wire Xero or QuickBooks via our recommended partner — hooks land in a future release.",
    category: "commerce",
    state: "partner",
    route: null,
    partner: {
      name: "Xero",
      url: "https://www.xero.com/uk/",
      note: "Free 30-day trial · integrated bookkeeping"
    },
    glyph: "🧾",
    expectedByTrades: [],
    // Real link to Finance Domain (S2.M). Partner integration covers
    // invoice-issue + statement-generation + MTD-VAT submission via
    // Xero/QuickBooks — we don't reimplement, we route.
    poweredByDomain: ["finance"],
    implementsCapability: [
      "finance.invoice-issue",
      "finance.statement-generation",
      "finance.mtd-vat-submission"
    ]
  },
  {
    id: "field-crm",
    name: "Field Service CRM",
    tagline: "Housecall Pro or Tradify — deep field CRMs.",
    description:
      "Full field-service CRMs are a $100B market. Rather than ship a lightweight lead-list disguised as 'CRM', we recommend a real one. Integration hooks in a later release.",
    category: "operations",
    state: "partner",
    route: null,
    partner: {
      name: "Tradify",
      url: "https://www.tradifyhq.com/uk/",
      note: "Trades-first CRM · used by 20,000+ UK tradies"
    },
    glyph: "🗂️",
    expectedByTrades: [],
    // Full CRM implementation — the whole Domain.
    poweredByDomain: ["crm"],
    implementsCapability: [
      "crm.lead-capture",
      "crm.deal-pipeline",
      "crm.duplicate-detection",
      "crm.review-request"
    ]
  },
  {
    id: "review-collection",
    name: "Review Collection",
    tagline: "NiceJob or Reputation — automated review requests.",
    description:
      "We generate review-request templates in the Local SEO Pack. Automated multi-touch review campaigns via partner tools.",
    category: "growth",
    state: "partner",
    route: null,
    partner: {
      name: "NiceJob",
      url: "https://get.nicejob.com/",
      note: "SMS + email review campaigns · Google + Facebook + Trustpilot"
    },
    glyph: "⭐",
    expectedByTrades: [],
    poweredByDomain: ["crm"],
    implementsCapability: ["crm.review-request"]
  },

  // ─── Coming soon (waitlist) ────────────────────────────────────
  {
    id: "stock",
    name: "Stock Management",
    tagline: "Live inventory tied to your product catalogue.",
    description:
      "Coming in Q2. Real-time stock counts, low-stock alerts, supplier reorder triggers. Aimed at merchants + retailers.",
    category: "commerce",
    state: "coming-soon",
    route: null,
    glyph: "📦",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "tool-merchant",
      "workwear-supplier"
    ],
    // Real link to Materials Domain (S2.E). Stock counts + reorder
    // triggers ride on catalogue-lookup + unit-conversion.
    poweredByDomain: ["materials"],
    implementsCapability: [
      "materials.catalogue-lookup",
      "materials.unit-conversion"
    ],

    // ─── DNA (S2.N) ──────────────────────────────────────────
    intent: {
      purpose:
        "Live stock counts tied to the product catalogue so a trade customer sees 'in stock — 12 available' instead of a call-to-check. Low-stock alerts + supplier reorder triggers keep the yard from stocking out mid-week.",
      businessGoals: [
        "reduce-friction",
        "operational-efficiency",
        "capture-leads"
      ]
    },
    runtime: {
      dependencies: ["shop-mode"],
      events: [
        {
          id: "stock.count-updated",
          emittedWhen: "Stock count changes (sale, receipt, adjustment).",
          payload: { product_id: "reference", count: "number" }
        },
        {
          id: "stock.low",
          emittedWhen: "Product crosses its low-stock threshold."
        },
        {
          id: "stock.out",
          emittedWhen: "Product hits zero — PDP flips to 'out of stock'."
        }
      ],
      permissions: [
        "read:materials.catalogue",
        "write:materials.stock-count"
      ],
      dataLifecycle: {
        creates: ["materials.stock-count", "materials.stock-adjustment"],
        reads: ["materials.product"],
        updates: ["materials.product"],
        ephemeral: false
      }
    },
    presentation: {
      pages: [],
      sections: ["product_grid.classic_3col_1"],
      navHooks: []
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "identical",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Stock indicators announce 'in stock', 'low stock — N remaining', or 'out of stock' via aria-label so screen readers get the same signal as visual users."
    },
    intelligence: {
      aiActions: [],
      recommendedAutomations: [
        "low-stock-supplier-reorder-alert",
        "back-in-stock-notify-waitlist"
      ],
      recommendedIntegrations: []
    },
    assemblyRules: [
      {
        id: "wire-to-shop-mode",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "shop-mode",
          priority: 90
        },
        rationale:
          "Stock counts only make sense on top of a product catalogue — wire the count into every PDP the moment Shop Mode is on."
      },
      {
        id: "suggest-lead-alerts-for-out-of-stock",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "lead-alerts",
          priority: 45
        },
        rationale:
          "Out-of-stock is a lost lead — Lead Alerts can capture the 'notify me when it's back' interest into the pipeline."
      },
      {
        id: "surface-in-growth-coach-on-low",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "studio.growth-coach-nudge",
          priority: 40
        },
        rationale:
          "Growth Coach card surfaces the top 3 low-stock SKUs each week so the merchant remembers to reorder before the weekend rush."
      }
    ]
  },
  {
    id: "delivery-tracking",
    name: "Delivery Tracking",
    tagline: "Live delivery map for customers + operators.",
    description:
      "Coming in Q3. Customer sees their order's location, ETA, driver contact. Uses HERE or Mapbox under the hood.",
    category: "operations",
    state: "coming-soon",
    route: null,
    glyph: "🚚",
    expectedByTrades: [
      "building-merchant",
      "timber-merchant",
      "aggregate-supplier",
      "concrete-supplier",
      "skip-hire"
    ],
    // Real link to Deliveries Domain (S2.E). Live tracking + driver
    // check-in are the customer-visible half of route-planning.
    poweredByDomain: ["deliveries"],
    implementsCapability: [
      "deliveries.delivery-tracking",
      "deliveries.driver-check-in"
    ]
  },
  {
    id: "customer-portal",
    name: "Customer Portal",
    tagline: "Trade accounts log in, see invoices, statements, orders.",
    description:
      "Coming in Q2. B2B customer-facing area — login, order history, statements, credit line, reorder-from-last. Follows Wholesale Mode.",
    category: "customer",
    state: "coming-soon",
    route: null,
    glyph: "🔐",
    expectedByTrades: ["building-merchant", "timber-merchant", "tool-merchant"],
    poweredByDomain: ["crm"],
    implementsCapability: ["crm.deal-pipeline"]
  },
  {
    id: "membership",
    name: "Membership",
    tagline: "Recurring plans for maintenance clients + landlords.",
    description:
      "Coming in Q3. Boiler cover, annual sweep, landlord CP12 renewals. Stripe subscriptions tied to your CRM.",
    category: "customer",
    state: "coming-soon",
    route: null,
    glyph: "🎫",
    expectedByTrades: [
      "gas-engineer",
      "heating-engineer",
      "chimney-sweep",
      "fire-protection"
    ],
    poweredByDomain: ["crm"],
    implementsCapability: ["crm.deal-pipeline"]
  },
  {
    id: "bookings",
    name: "Online Bookings",
    tagline: "Customers pick a slot from your calendar.",
    description:
      "Coming in Q2. Two-way sync with Google Calendar. Buffer time, travel time, blackout dates.",
    category: "customer",
    state: "coming-soon",
    route: null,
    glyph: "📅",
    expectedByTrades: [
      "electrician",
      "plumber",
      "gas-engineer",
      "handyman",
      "chimney-sweep",
      "chartered-surveyor"
    ],
    // Real link to Scheduling Domain (S2.E). The customer picks a slot
    // that respects the merchant's calendar sync + buffer/travel rules.
    poweredByDomain: ["scheduling"],
    implementsCapability: [
      "scheduling.slot-lookup",
      "scheduling.calendar-sync",
      "scheduling.buffer-time",
      "scheduling.blackout-management"
    ],

    // ─── DNA (S2.N) ──────────────────────────────────────────
    intent: {
      purpose:
        "Let a customer pick a slot from the merchant's calendar without a phone call. Two-way Google Calendar sync so the merchant's dashboard is the single source of truth for availability. Buffer + travel time honoured so back-to-back bookings don't collide.",
      businessGoals: [
        "capture-leads",
        "reduce-friction",
        "operational-efficiency"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "bookings.slot-requested",
          emittedWhen: "Customer picks a slot on the public page.",
          payload: {
            slot_start_at: "date",
            postcode: "string"
          }
        },
        {
          id: "bookings.slot-confirmed",
          emittedWhen: "Merchant confirms (or the auto-confirm rule fires).",
          payload: { booking_id: "reference" }
        },
        {
          id: "bookings.slot-cancelled",
          emittedWhen: "Customer or merchant cancels."
        }
      ],
      permissions: [
        "read:google-calendar",
        "write:google-calendar",
        "write:scheduling.slot"
      ],
      dataLifecycle: {
        creates: ["scheduling.slot", "scheduling.booking"],
        reads: ["crm.contact", "crm.deal"],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: ["page.contact", "page.services"],
      sections: [],
      navHooks: ["nav.header"]
    },
    behaviour: {
      seoImpact: "positive",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Slot grid is keyboard-navigable; unavailable slots announce their reason (past / blocked); confirmation live-region announces success."
    },
    intelligence: {
      aiActions: ["copy.rewrite"],
      recommendedAutomations: [
        "auto-confirm-in-hours",
        "reminder-sms-24h-before",
        "reschedule-link-in-email"
      ],
      recommendedIntegrations: ["google-calendar", "twilio-sms", "resend"]
    },
    assemblyRules: [
      {
        id: "add-nav-book-now",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-nav-item",
          target: "nav.header",
          priority: 70
        },
        rationale:
          "'Book' or 'Book now' in the header nav is the strongest signal to a returning customer that they don't need to call — one of the highest-lift nav additions we see."
      },
      {
        id: "swap-home-primary-cta",
        trigger: { kind: "on-install" },
        action: {
          kind: "add-cta",
          target: "home.primary-cta",
          priority: 75
        },
        rationale:
          "'Book a slot' converts faster than 'Get a quote' on service trades — replace the primary home CTA when bookings are live."
      },
      {
        id: "wire-to-lead-alerts",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "lead-alerts",
          priority: 65
        },
        rationale:
          "Every new booking is a lead the merchant should hear about within seconds — wire the booking event to the alert channel."
      },
      {
        id: "suggest-quote-pipeline-if-missing",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "quote-pipeline",
          priority: 45
        },
        rationale:
          "Bookings often need a follow-up quote (survey → full job) — pipeline handles the second-touch that turns a slot into a project."
      }
    ]
  },
  {
    id: "staff-management",
    name: "Staff Management",
    tagline: "Assign jobs, track hours, manage certifications.",
    description:
      "Coming in Q3. Team roster with CSCS/IPAF/PASMA expiry tracking, timesheet, day-rate management.",
    category: "team",
    state: "coming-soon",
    route: null,
    glyph: "🦺",
    expectedByTrades: [
      "builder",
      "commercial-roofing",
      "groundworker",
      "commercial-builder"
    ],
    // Real link to Staff Domain (S2.M) — the primary owner of the
    // roster + certification-tracking capabilities — plus Scheduling
    // for the blackout surface and Compliance for CSCS/IPAF expiry
    // register scans.
    poweredByDomain: ["staff", "scheduling", "compliance"],
    implementsCapability: [
      "staff.roster",
      "staff.timesheet",
      "staff.certification-tracking",
      "scheduling.blackout-management"
    ]
  },
  {
    id: "analytics",
    name: "Analytics Dashboard",
    tagline: "Real numbers — visits, quotes, conversion, revenue.",
    description:
      "Coming in Q2. Live counters + week/month/year trends. Honest metrics, no vanity dashboards.",
    category: "insight",
    state: "coming-soon",
    route: null,
    glyph: "📊",
    expectedByTrades: [],
    // Real link to Marketing Domain (S2.E). Attribution to Deals hangs
    // off UTM-tagged Campaigns owned by the Marketing Domain.
    poweredByDomain: ["marketing"],
    implementsCapability: ["marketing.campaign-tracking"],

    // ─── DNA (S2.N) ──────────────────────────────────────────
    intent: {
      purpose:
        "Give the merchant real numbers — visits, quotes, conversion %, revenue — without the vanity noise of standard analytics dashboards. UTM-tagged Campaigns from the Marketing Domain attribute revenue back to source.",
      businessGoals: [
        "operational-efficiency",
        "brand-authority"
      ]
    },
    runtime: {
      dependencies: [],
      events: [
        {
          id: "analytics.metric-view",
          emittedWhen:
            "Merchant loads the analytics dashboard (used to warm caches).",
          payload: { period: "string" }
        },
        {
          id: "analytics.export",
          emittedWhen:
            "Merchant exports a metrics CSV — usually for accountant or grant application."
        }
      ],
      permissions: [
        "read:crm.deal",
        "read:finance.payment",
        "read:marketing.campaign"
      ],
      dataLifecycle: {
        creates: [],
        reads: ["crm.deal", "finance.payment", "marketing.campaign"],
        updates: [],
        ephemeral: false
      }
    },
    presentation: {
      pages: [],
      sections: [],
      navHooks: ["studio.home.above-fold"]
    },
    behaviour: {
      seoImpact: "neutral",
      mobileBehaviour: "adapted",
      offlineBehaviour: "read-only",
      a11yNotes:
        "Every chart has a matching data table so screen-reader users get the same numbers; period-selector announces the active window on change."
    },
    intelligence: {
      aiActions: ["copy.rewrite"],
      recommendedAutomations: [
        "monthly-summary-email",
        "conversion-drop-alert"
      ],
      recommendedIntegrations: ["google-analytics-4"]
    },
    assemblyRules: [
      {
        id: "surface-above-fold",
        trigger: { kind: "on-install" },
        action: {
          kind: "insert-section",
          target: "studio.home.above-fold",
          priority: 65
        },
        rationale:
          "The core numbers earn their place above the fold on the Studio home so the merchant sees them without a click every time they open the dashboard."
      },
      {
        id: "wire-to-quote-pipeline",
        trigger: { kind: "on-install" },
        action: {
          kind: "wire-to",
          target: "quote-pipeline",
          priority: 60
        },
        rationale:
          "Pipeline stage counts (drafted / sent / won / lost) belong in the analytics view — wire the pipeline as a source once both are installed."
      },
      {
        id: "suggest-payments-for-revenue-attribution",
        trigger: { kind: "on-install" },
        action: {
          kind: "suggest-module",
          target: "payments",
          priority: 40
        },
        rationale:
          "Revenue numbers are only accurate when payments are captured on-platform — suggest Payments so the analytics view isn't blind to what actually landed in the bank."
      }
    ]
  },
  {
    id: "ai-assistant",
    name: "Industry AI Assistant",
    tagline: "Your trade-aware AI copilot inside Studio.",
    description:
      "Coming in Q3. Trade-specialised system prompt + retrieval over your blueprint, credentials, and coverage. Suggests improvements, drafts copy, answers 'is this legal to say?' compliance questions.",
    category: "insight",
    state: "coming-soon",
    route: null,
    glyph: "🤖",
    expectedByTrades: [],
    // Consumes ALL Domains via the AI Brain retrieval architecture,
    // but doesn't implement a capability itself.
    poweredByDomain: [],
    implementsCapability: []
  }
];

// ─── Lookups ─────────────────────────────────────────────────────

export function getModule(id: string): BusinessModule | undefined {
  return BUSINESS_MODULES.find((m) => m.id === id);
}

export function modulesByState(state: BusinessModule["state"]): BusinessModule[] {
  return BUSINESS_MODULES.filter((m) => m.state === state);
}

export function modulesForTrade(tradeSlug: string): BusinessModule[] {
  return BUSINESS_MODULES.filter(
    (m) =>
      m.expectedByTrades.length === 0 || m.expectedByTrades.includes(tradeSlug)
  );
}

// ─── Knowledge Graph queries (S1.3) ──────────────────────────────

/** Modules that implement pieces of a given Domain. Used by the
 *  Recommendation Engine when walking a resolved Knowledge Package. */
export function modulesForDomain(domainId: string): BusinessModule[] {
  return BUSINESS_MODULES.filter((m) => m.poweredByDomain.includes(domainId as never));
}

/** Modules that implement a specific "<domainId>.<capabilityId>" pair.
 *  Multiple modules may implement the same capability (partner + first
 *  party) — caller decides. */
export function modulesForCapability(
  capabilityRef: string
): BusinessModule[] {
  return BUSINESS_MODULES.filter((m) =>
    m.implementsCapability.includes(capabilityRef)
  );
}

/** Coverage report — for the audit dashboards. Which Domains have
 *  Module implementations vs which are still contract-only. */
export function moduleCoverageByDomain(): Record<
  string,
  { modules: string[]; capabilitiesCovered: string[] }
> {
  const out: Record<
    string,
    { modules: string[]; capabilitiesCovered: string[] }
  > = {};
  for (const m of BUSINESS_MODULES) {
    for (const d of m.poweredByDomain) {
      if (!out[d]) out[d] = { modules: [], capabilitiesCovered: [] };
      out[d].modules.push(m.id);
      for (const cap of m.implementsCapability) {
        if (cap.startsWith(`${d}.`) && !out[d].capabilitiesCovered.includes(cap)) {
          out[d].capabilitiesCovered.push(cap);
        }
      }
    }
  }
  return out;
}
