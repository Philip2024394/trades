// NEX App Builder · Staircase-company worked example (Philip 2026-08-14).
//
// This is the Blueprint NEX SHOULD produce from the "golden staircase"
// customer request. It's stored as executable code (not JSON) so the type
// system verifies it matches the schema. It's used by:
//   - Snapshot tests (assert NEX still generates the right shape)
//   - Studio-side rendering tests (render this Blueprint into a preview)
//   - Worker-side dry-runs (walk the WorkerTaskRef graph without executing)
//
// Customer request (verbatim):
//   "Build me a premium staircase company website. I want a beautiful
//    staircase image gallery on the homepage. Include: Home, About Us,
//    Products, Services, Gallery, Contact Us. The Contact page must show
//    our service-area radius. Products must be displayed as professional
//    cards with images, descriptions and prices. Include a Stripe checkout
//    flow. Use a premium architectural staircase design style. Make the
//    application responsive and professional."

import type { AppBlueprint } from "../blueprint-schema";
import { setKnown, setInferred, setRequired } from "../provenance";

let prov = {};
prov = setKnown(prov, "vertical.taxonomySlug", "customer:turn-1", "'staircase company'");
prov = setInferred(prov, "vertical.archetype", "brain:staircase.premium-archetype", 0.85, "'premium'");
prov = setKnown(prov, "brand.toneOfVoice", "customer:turn-1", "'premium architectural' → premium");
prov = setInferred(prov, "brand.palette.primary", "brain:premium-defaults", 0.7, "warm oak accent (staircase Reference Brain)");
prov = setKnown(prov, "brand.palette.background", "brain:premium-defaults", "off-white for premium feel");
prov = setKnown(prov, "brand.palette.foreground", "brain:premium-defaults", "near-black ink");
prov = setInferred(prov, "brand.typography.headingFamily", "brain:premium-defaults", 0.75, "serif for premium heritage");
prov = setKnown(prov, "brand.typography.bodyFamily", "brain:premium-defaults", "clean sans body");
prov = setRequired(prov, "identity.displayName", "customer did not name the company");
prov = setRequired(prov, "identity.contact.primaryEmail", "customer did not provide");
prov = setRequired(prov, "identity.contact.primaryPhone", "customer did not provide");
prov = setRequired(prov, "identity.contact.serviceRadius.centre", "customer said 'our service-area radius' but did not give postcode");
prov = setRequired(prov, "identity.contact.serviceRadius.radiusMiles", "customer did not give a mile value");
prov = setKnown(prov, "pages.home", "customer:turn-1", "'Home'");
prov = setKnown(prov, "pages.about", "customer:turn-1", "'About Us'");
prov = setKnown(prov, "pages.products", "customer:turn-1", "'Products'");
prov = setKnown(prov, "pages.services", "customer:turn-1", "'Services'");
prov = setKnown(prov, "pages.gallery", "customer:turn-1", "'Gallery'");
prov = setKnown(prov, "pages.contact", "customer:turn-1", "'Contact Us'");
prov = setKnown(prov, "navigation.primary", "brain:standard-nav", "derived from pages list");
prov = setKnown(prov, "footer.columns", "brain:standard-footer", "standard 3-column footer");
prov = setKnown(prov, "responsive.strategy", "customer:turn-1", "'responsive and professional' → mobile-first");
prov = setKnown(prov, "seo.siteTitleTemplate", "brain:standard-seo", "'{pageTitle} — {displayName}'");
prov = setInferred(prov, "seo.defaultDescription", "brain:staircase-copy", 0.6, "generic premium staircase blurb pending customer edit");

export const staircaseCompanyBlueprint: AppBlueprint = {
  blueprintVersion: 1,
  id: "ab_staircase_example",
  name: "[Staircase Company Name]",
  tagline: "Bespoke architectural staircases",
  identity: {
    displayName: "[Staircase Company Name]",
    contact: {
      // These are all REQUIRED but empty · classifyBlueprint will surface them
    },
    locations: []
  },
  domain: {
    primary: undefined,
    preview: "staircase-example.nex.local"
  },
  vertical: {
    taxonomySlug: "staircase-manufacture",
    archetype: "premium"
  },
  brand: {
    palette: {
      primary: "#8b5a2b",       // warm oak
      onPrimary: "#ffffff",
      accent: "#c9a26a",
      background: "#f8f6f2",    // off-white
      foreground: "#1a1a1a",
      muted: "#6a6a6a",
      border: "#e4dfd6"
    },
    typography: {
      headingFamily: "\"Playfair Display\", Georgia, serif",
      bodyFamily: "\"Inter\", -apple-system, sans-serif",
      scale: 1.25
    },
    toneOfVoice: "premium",
    imageryDirection: [
      "hardwood",
      "oak",
      "walnut",
      "architectural",
      "handcrafted",
      "cantilever",
      "curved",
      "stringer detail"
    ]
  },
  pages: [
    {
      id: "home",
      path: "/",
      title: "Home",
      purpose: "First impression · premium hero · gallery preview · featured products · lead capture",
      sections: [
        {
          instanceId: "home_hero_1",
          registryId: "hero/photo-full",
          props: {
            headline: "Bespoke staircases · handcrafted for premium homes",
            subhead: "[Optional subhead — INFERRED]",
            cta: { label: "See our work", target: { kind: "page", pageId: "gallery" } }
          },
          data: { source: "hero_images", limit: 1 }
        },
        {
          instanceId: "home_gallery_1",
          registryId: "gallery/grid",
          props: { title: "Recent installations", columns: 3, aspect: "3:4" },
          data: { source: "projects", limit: 6, orderBy: { field: "created_at", dir: "desc" } }
        },
        {
          instanceId: "home_featured_products_1",
          registryId: "product_grid/classic3col",
          props: { title: "Featured designs", limit: 3 },
          data: { source: "products", limit: 3, where: { featured: true } }
        },
        {
          instanceId: "home_cta_1",
          registryId: "cta/split-cta",
          props: {
            headline: "Planning a project?",
            body: "Tell us about your space — we design and manufacture bespoke.",
            cta: { label: "Get in touch", target: { kind: "page", pageId: "contact" } }
          }
        }
      ]
    },
    {
      id: "about",
      path: "/about",
      title: "About Us",
      sections: [
        {
          instanceId: "about_hero_1",
          registryId: "hero/simple-heading",
          props: { headline: "About [Staircase Company Name]", eyebrow: "Craftsmanship since [year]" }
        },
        {
          instanceId: "about_body_1",
          registryId: "content/prose",
          props: { markdown: "[About copy — REQUIRED · customer to supply or worker to generate]" }
        },
        {
          instanceId: "about_team_1",
          registryId: "team/grid",
          props: { title: "Our team" },
          data: { source: "team" }
        }
      ]
    },
    {
      id: "products",
      path: "/products",
      title: "Products",
      purpose: "Full catalogue with card view · leads to product detail with checkout",
      sections: [
        {
          instanceId: "products_hero_1",
          registryId: "hero/simple-heading",
          props: { headline: "Our staircase range" }
        },
        {
          instanceId: "products_grid_1",
          registryId: "product_grid/classic3col",
          props: { title: null, showFilter: true, showPrice: true },
          data: { source: "products", orderBy: { field: "price", dir: "asc" } }
        }
      ]
    },
    {
      id: "product-detail",
      path: "/products/:slug",
      title: "Product detail",
      purpose: "Per-product deep view + Stripe checkout entry",
      sections: [
        {
          instanceId: "product_detail_hero_1",
          registryId: "product/detail-hero",
          props: { showBuyButton: true },
          data: { source: "products", where: { slug: ":slug" }, limit: 1 },
          actions: [
            {
              kind: "integration",
              provider: "stripe",
              op: "checkout.session.create",
              payload: { productSlugParam: ":slug" }
            }
          ]
        }
      ]
    },
    {
      id: "services",
      path: "/services",
      title: "Services",
      sections: [
        { instanceId: "services_hero_1", registryId: "hero/simple-heading", props: { headline: "Services" } },
        {
          instanceId: "services_grid_1",
          registryId: "services/grid",
          props: {},
          data: { source: "services" }
        }
      ]
    },
    {
      id: "gallery",
      path: "/gallery",
      title: "Gallery",
      sections: [
        { instanceId: "gallery_hero_1", registryId: "hero/simple-heading", props: { headline: "Gallery" } },
        {
          instanceId: "gallery_masonry_1",
          registryId: "gallery/masonry",
          props: { columns: 4 },
          data: { source: "projects" }
        }
      ]
    },
    {
      id: "contact",
      path: "/contact",
      title: "Contact Us",
      sections: [
        { instanceId: "contact_hero_1", registryId: "hero/simple-heading", props: { headline: "Contact" } },
        {
          instanceId: "contact_form_1",
          registryId: "contact/split",
          props: {
            fields: ["name", "email", "phone", "project_details"],
            requiredFields: ["name", "email", "project_details"]
          },
          actions: [
            {
              kind: "submit-form",
              formId: "contact_form_1",
              onSuccess: { kind: "navigate", to: "/contact/thanks" }
            }
          ]
        },
        {
          instanceId: "contact_service_radius_1",
          registryId: "map/service-radius",
          props: {
            title: "Where we work",
            /** Bound to identity.contact.serviceRadius — REQUIRED */
            bindTo: "identity.contact.serviceRadius"
          }
        }
      ]
    }
  ],
  navigation: {
    primary: [
      { label: "Home", target: { kind: "page", pageId: "home" } },
      { label: "About", target: { kind: "page", pageId: "about" } },
      { label: "Products", target: { kind: "page", pageId: "products" } },
      { label: "Services", target: { kind: "page", pageId: "services" } },
      { label: "Gallery", target: { kind: "page", pageId: "gallery" } },
      { label: "Contact", target: { kind: "page", pageId: "contact" } }
    ],
    mobileBehaviour: "drawer",
    ctaSlot: { label: "Get in touch", action: { kind: "navigate", to: "/contact" } }
  },
  footer: {
    columns: [
      {
        title: "Company",
        entries: [
          { label: "About", target: { kind: "page", pageId: "about" } },
          { label: "Services", target: { kind: "page", pageId: "services" } }
        ]
      },
      {
        title: "Explore",
        entries: [
          { label: "Products", target: { kind: "page", pageId: "products" } },
          { label: "Gallery", target: { kind: "page", pageId: "gallery" } }
        ]
      },
      {
        title: "Contact",
        entries: [
          { label: "Get in touch", target: { kind: "page", pageId: "contact" } }
        ]
      }
    ],
    legalLinks: [
      { label: "Terms", target: { kind: "url", href: "/legal/terms" } },
      { label: "Privacy", target: { kind: "url", href: "/legal/privacy" } }
    ],
    copyrightTemplate: "© {year} {displayName}"
  },
  data: [
    {
      id: "products",
      label: "Products",
      required: true,
      fields: [
        { name: "slug", kind: "text", required: true },
        { name: "name", kind: "text", required: true },
        { name: "description", kind: "richtext", required: true },
        { name: "price", kind: "currency", required: true, hint: "GBP" },
        { name: "images", kind: "images", required: true, min: 1 },
        { name: "featured", kind: "boolean", required: false }
      ]
    },
    {
      id: "projects",
      label: "Projects",
      required: false,
      fields: [
        { name: "title", kind: "text", required: true },
        { name: "images", kind: "images", required: true, min: 1 },
        { name: "location", kind: "text", required: false },
        { name: "year_completed", kind: "number", required: false }
      ]
    },
    {
      id: "services",
      label: "Services",
      required: false,
      fields: [
        { name: "name", kind: "text", required: true },
        { name: "summary", kind: "text", required: true }
      ]
    },
    {
      id: "team",
      label: "Team",
      required: false,
      fields: [
        { name: "name", kind: "text", required: true },
        { name: "role", kind: "text", required: true },
        { name: "photo", kind: "image", required: false }
      ]
    },
    {
      id: "hero_images",
      label: "Hero images",
      required: true,
      fields: [
        { name: "asset", kind: "image", required: true },
        { name: "alt", kind: "text", required: true }
      ]
    }
  ],
  integrations: [
    {
      provider: "stripe",
      purpose: "Product checkout for the Products/Product-detail pages",
      operations: ["checkout.session.create", "webhook.checkout.session.completed"],
      optional: false,
      requiredConfig: ["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
    },
    {
      provider: "google-maps",
      purpose: "Service-area radius map on Contact page",
      operations: ["render.map", "compute.radius"],
      optional: false,
      requiredConfig: ["GOOGLE_MAPS_API_KEY"]
    },
    {
      provider: "resend",
      purpose: "Contact form delivery",
      operations: ["send.email"],
      optional: true,
      requiredConfig: ["RESEND_API_KEY"]
    }
  ],
  seo: {
    siteTitleTemplate: "{pageTitle} — {displayName}",
    defaultDescription: "Bespoke architectural staircases · handcrafted for premium homes.",
    robots: "index,follow"
  },
  responsive: {
    breakpoints: { mobile: 640, tablet: 1024, desktop: 1440 },
    strategy: "mobile-first",
    navCollapses: true
  },
  workerTasks: [],
  provenance: prov,
  sourceUtterances: [
    "Build me a premium staircase company website. I want a beautiful staircase image gallery on the homepage. Include: Home, About Us, Products, Services, Gallery, Contact Us. The Contact page must show our service-area radius. Products must be displayed as professional cards with images, descriptions and prices. Include a Stripe checkout flow. Use a premium architectural staircase design style. Make the application responsive and professional."
  ],
  meta: {
    createdAt: "2026-08-14T00:00:00Z",
    updatedAt: "2026-08-14T00:00:00Z",
    revision: 1
  }
};
