// NEX App Builder · Phase 10 · Diversity fixtures (Philip 2026-08-14).
//
// Ten distinct real-customer Blueprints proving NEX isn't staircase-specific.
// Each fixture is a genuine mini-Blueprint · not a copy of the staircase one.
//
// Scenarios (per Philip's spec):
//   1. Simple website (small local business, few pages)
//   2. Multi-page website (Home/About/Services/Gallery/Contact)
//   3. Image-heavy website (lots of photos + galleries + projects)
//   4. Ecommerce (products + prices + images + Stripe)
//   5. Service business (services + service radius + contact)
//   6. Missing information (customer didn't supply key facts)
//   7. Conflicting information (customer contradicts themselves)
//   8. Changing requirements (modern → traditional)
//   9. Bad/unclear request (vague vertical + empty intent)
//   10. Large website (15+ pages, stress test)
//
// Constitutional rule: every fixture uses the SAME schema, SAME workers,
// SAME adapter, SAME QA rules. No test loosens any rule to pass.

import type { AppBlueprint, PageSpec, SectionInstance, DataModelSpec, IntegrationRequirement, NavEntry } from "../blueprint-schema";
import { setKnown, setInferred, setRequired } from "../provenance";

// ============================================================================
// Helpers — keep every fixture terse
// ============================================================================

let INSTANCE_COUNTER = 0;
function sid(prefix = "s"): string {
  return `${prefix}_${(INSTANCE_COUNTER++).toString(36)}`;
}

function section(registryId: string, props: Record<string, unknown> = {}, extras: Partial<SectionInstance> = {}): SectionInstance {
  return { instanceId: sid("s"), registryId, props, ...extras };
}

function page(id: string, path: string, title: string, sections: SectionInstance[], purpose?: string): PageSpec {
  return { id, path, title, sections, purpose };
}

function nav(pages: PageSpec[]): NavEntry[] {
  return pages.map((p) => ({ label: p.title, target: { kind: "page" as const, pageId: p.id } }));
}

type MakeBlueprintOptions = {
  id: string;
  name: string;
  displayName: string;
  taxonomySlug: string;
  archetype?: AppBlueprint["vertical"]["archetype"];
  toneOfVoice?: AppBlueprint["brand"]["toneOfVoice"];
  primary?: string;
  fontHeading?: string;
  fontBody?: string;
  pages: PageSpec[];
  data?: DataModelSpec[];
  integrations?: IntegrationRequirement[];
  contactRadius?: { postcode: string; miles: number };
  provenanceOverrides?: (p: Record<string, unknown>) => Record<string, unknown>;
  imageryDirection?: string[];
};

function makeBlueprint(opts: MakeBlueprintOptions): AppBlueprint {
  let prov: Record<string, unknown> = {};
  prov = setKnown(prov, "vertical.taxonomySlug", "customer:phase10-fixture", "supplied by scenario");
  prov = setKnown(prov, "identity.displayName", "customer:phase10-fixture", "supplied by scenario");
  prov = setKnown(prov, "brand.palette.primary", "customer:phase10-fixture", "supplied by scenario");
  prov = setKnown(prov, "brand.palette.background", "brand-defaults", "off-white default");
  prov = setKnown(prov, "brand.palette.foreground", "brand-defaults", "near-black");
  prov = setKnown(prov, "brand.typography.headingFamily", "customer:phase10-fixture", "supplied by scenario");
  prov = setKnown(prov, "brand.typography.bodyFamily", "brand-defaults", "Inter body");
  prov = setKnown(prov, "responsive.strategy", "customer:phase10-fixture", "mobile-first");
  prov = setKnown(prov, "navigation.primary", "brain:standard-nav", "derived from pages");
  prov = setKnown(prov, "footer.columns", "brain:standard-footer", "standard footer");
  for (const p of opts.pages) prov = setKnown(prov, `pages.${p.id}`, "customer:phase10-fixture", "supplied by scenario");
  if (opts.contactRadius) {
    prov = setKnown(prov, "identity.contact.serviceRadius.centre", "customer:phase10-fixture", "supplied");
    prov = setKnown(prov, "identity.contact.serviceRadius.radiusMiles", "customer:phase10-fixture", "supplied");
  }
  if (opts.provenanceOverrides) prov = opts.provenanceOverrides(prov);

  return {
    blueprintVersion: 1,
    id: opts.id,
    name: opts.name,
    identity: {
      displayName: opts.displayName,
      contact: opts.contactRadius
        ? { serviceRadius: { centre: { kind: "postcode", value: opts.contactRadius.postcode }, radiusMiles: opts.contactRadius.miles } }
        : {},
      locations: []
    },
    domain: { primary: undefined },
    vertical: { taxonomySlug: opts.taxonomySlug, archetype: opts.archetype },
    brand: {
      palette: {
        primary:    opts.primary ?? "#2c5f8d",
        onPrimary:  "#ffffff",
        background: "#f8f6f2",
        foreground: "#1a1a1a"
      },
      typography: {
        headingFamily: opts.fontHeading ?? "\"Inter\", sans-serif",
        bodyFamily:    opts.fontBody ?? "\"Inter\", sans-serif"
      },
      toneOfVoice: opts.toneOfVoice,
      imageryDirection: opts.imageryDirection
    },
    pages: opts.pages,
    navigation: { primary: nav(opts.pages), mobileBehaviour: "drawer" },
    footer: {
      columns: [{ title: opts.displayName, entries: [] }],
      legalLinks: [],
      copyrightTemplate: "© {year} {displayName}"
    },
    data: opts.data ?? [],
    integrations: opts.integrations ?? [],
    seo: { siteTitleTemplate: "{pageTitle} — {displayName}", defaultDescription: opts.name, robots: "index,follow" },
    responsive: { breakpoints: { mobile: 640, tablet: 1024, desktop: 1440 }, strategy: "mobile-first", navCollapses: true },
    workerTasks: [],
    provenance: prov as AppBlueprint["provenance"],
    sourceUtterances: [`[phase10 fixture] ${opts.name}`],
    meta: { createdAt: "2026-08-14T00:00:00Z", updatedAt: "2026-08-14T00:00:00Z", revision: 1 }
  };
}

// ============================================================================
// Scenario 1 · Simple local business (3 pages)
// ============================================================================

export function scenario1_SimpleElectrician(): AppBlueprint {
  const home    = page("home",    "/",         "Home",    [section("hero/simple-heading", { headline: "Chelsea Electrical Services" }), section("cta/split-cta", { headline: "24-hour emergency call-out", body: "Trusted local electricians in SW London." })]);
  const services = page("services", "/services", "Services", [section("hero/simple-heading", { headline: "Services" }), section("services/grid", { heading: "What we do" }, { data: { source: "services" } })]);
  const contact = page("contact", "/contact",  "Contact", [section("hero/simple-heading", { headline: "Contact" }), section("contact/split", { fields: ["name", "phone", "message"] })]);
  return makeBlueprint({
    id: "ab_p10_s1",
    name: "Chelsea Electrical Services",
    displayName: "Chelsea Electrical Services",
    taxonomySlug: "electrician",
    archetype: "traditional",
    toneOfVoice: "no-nonsense",
    pages: [home, services, contact],
    data: [{ id: "services", label: "Services", required: false, fields: [{ name: "name", kind: "text", required: true }, { name: "summary", kind: "text", required: true }], seed: [{ name: "Rewiring", summary: "Full-house rewiring" }, { name: "EICR reports", summary: "Landlord compliance" }] }]
  });
}

// ============================================================================
// Scenario 2 · Multi-page (Home/About/Services/Gallery/Contact)
// ============================================================================

export function scenario2_MultiPageKitchen(): AppBlueprint {
  const pages = [
    page("home",     "/",         "Home",     [section("hero/photo-full", { headline: "Bespoke kitchens for London homes" }), section("cta/split-cta", {})]),
    page("about",    "/about",    "About",    [section("hero/simple-heading", { headline: "About us" }), section("content/prose", { markdown: "Since 2010." })]),
    page("services", "/services", "Services", [section("services/grid", {}, { data: { source: "services" } })]),
    page("gallery",  "/gallery",  "Gallery",  [section("gallery/grid", { columns: 3 }, { data: { source: "projects" } })]),
    page("contact",  "/contact",  "Contact",  [section("contact/split", {})])
  ];
  return makeBlueprint({
    id: "ab_p10_s2",
    name: "Marylebone Kitchen Studio",
    displayName: "Marylebone Kitchen Studio",
    taxonomySlug: "kitchen-fitter",
    archetype: "premium",
    toneOfVoice: "premium",
    primary: "#3a5a40",
    pages,
    data: [
      { id: "services", label: "Services", required: true, fields: [{ name: "name", kind: "text", required: true }, { name: "summary", kind: "text", required: true }], seed: [{ name: "Design consultation", summary: "In-home visit" }, { name: "Installation", summary: "Turn-key" }] },
      { id: "projects", label: "Projects", required: false, fields: [{ name: "title", kind: "text", required: true }, { name: "images", kind: "images", required: true, min: 1 }], seed: [{ title: "Notting Hill kitchen" }] }
    ]
  });
}

// ============================================================================
// Scenario 3 · Image-heavy (photographer)
// ============================================================================

export function scenario3_ImageHeavyPhotographer(): AppBlueprint {
  const pages = [
    page("home",     "/",         "Home",     [section("hero/photo-full", { headline: "Elena Whitmore · Portraits" }), section("gallery/grid", { columns: 4 }, { data: { source: "portraits", limit: 12 } })]),
    page("portraits","/portraits","Portraits",[section("gallery/masonry", { columns: 4 }, { data: { source: "portraits" } })]),
    page("weddings", "/weddings", "Weddings", [section("gallery/grid", { columns: 3 }, { data: { source: "weddings" } })]),
    page("about",    "/about",    "About",    [section("hero/simple-heading", { headline: "About" }), section("content/prose", {})]),
    page("contact",  "/contact",  "Contact",  [section("contact/split", {})])
  ];
  return makeBlueprint({
    id: "ab_p10_s3",
    name: "Elena Whitmore Photography",
    displayName: "Elena Whitmore Photography",
    taxonomySlug: "photographer",
    archetype: "premium",
    toneOfVoice: "artisanal",
    primary: "#000000",
    fontHeading: "\"Playfair Display\", serif",
    imageryDirection: ["portrait", "editorial", "minimalist"],
    pages,
    data: [
      { id: "portraits", label: "Portrait sessions", required: true, fields: [{ name: "title", kind: "text", required: true }, { name: "images", kind: "images", required: true, min: 1 }], seed: [{ title: "Sarah" }, { title: "James" }] },
      { id: "weddings", label: "Wedding galleries", required: false, fields: [{ name: "title", kind: "text", required: true }, { name: "images", kind: "images", required: true, min: 1 }], seed: [{ title: "Sarah & James, Sept 2025" }] }
    ]
  });
}

// ============================================================================
// Scenario 4 · Ecommerce (furniture + Stripe)
// ============================================================================

export function scenario4_EcommerceFurniture(): AppBlueprint {
  const pages = [
    page("home",           "/",                    "Home",     [section("hero/photo-full", { headline: "Handmade furniture" }), section("product_grid/classic3col", { title: "Featured", limit: 3 }, { data: { source: "products", where: { featured: true } } })]),
    page("products",       "/products",            "Products", [section("product_grid/classic3col", {}, { data: { source: "products" } })]),
    page("product-detail", "/products/:slug",      "Product",  [section("product/detail-hero", { showBuyButton: true }, { data: { source: "products", where: { slug: ":slug" } }, actions: [{ kind: "integration", provider: "stripe", op: "checkout.session.create", payload: { productSlugParam: ":slug" } }] })]),
    page("contact",        "/contact",             "Contact",  [section("contact/split", {})])
  ];
  return makeBlueprint({
    id: "ab_p10_s4",
    name: "Thornton Wood Furniture",
    displayName: "Thornton Wood Furniture",
    taxonomySlug: "furniture-maker",
    archetype: "premium",
    toneOfVoice: "artisanal",
    primary: "#8b5a2b",
    pages,
    data: [{
      id: "products", label: "Products", required: true,
      fields: [{ name: "slug", kind: "text", required: true }, { name: "name", kind: "text", required: true }, { name: "description", kind: "richtext", required: true }, { name: "price", kind: "currency", required: true }, { name: "images", kind: "images", required: true, min: 1 }, { name: "featured", kind: "boolean", required: false }],
      seed: [
        { slug: "oak-dining-table", name: "Oak dining table", description: "Solid oak with breadboard ends", price: { amount: 189000, currency: "GBP" }, featured: true },
        { slug: "walnut-sideboard", name: "Walnut sideboard", description: "Waterfall grain American walnut", price: { amount: 245000, currency: "GBP" }, featured: true },
        { slug: "ash-bench",        name: "Ash bench",        description: "Hand-shaped seat, forged steel legs", price: { amount: 68000,  currency: "GBP" }, featured: false }
      ]
    }],
    integrations: [
      { provider: "stripe", purpose: "Product checkout", operations: ["checkout.session.create"], optional: false, requiredConfig: ["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] }
    ]
  });
}

// ============================================================================
// Scenario 5 · Service business with service radius (plumber)
// ============================================================================

export function scenario5_ServiceBusinessPlumber(): AppBlueprint {
  const pages = [
    page("home",     "/",         "Home",     [section("hero/simple-heading", { headline: "Fast, honest plumbing" }), section("cta/split-cta", {})]),
    page("services", "/services", "Services", [section("services/grid", {}, { data: { source: "services" } })]),
    page("coverage", "/coverage", "Coverage", [section("hero/simple-heading", { headline: "Where we work" }), section("map/service-radius", { title: "Coverage area", bindTo: "identity.contact.serviceRadius" })]),
    page("contact",  "/contact",  "Contact",  [section("contact/split", { fields: ["name", "phone", "postcode", "issue"] })])
  ];
  return makeBlueprint({
    id: "ab_p10_s5",
    name: "Harborne Plumbing & Heating",
    displayName: "Harborne Plumbing & Heating",
    taxonomySlug: "plumber",
    archetype: "traditional",
    toneOfVoice: "no-nonsense",
    primary: "#1e4d8b",
    pages,
    data: [{ id: "services", label: "Services", required: true, fields: [{ name: "name", kind: "text", required: true }, { name: "summary", kind: "text", required: true }], seed: [{ name: "Boiler repair" }, { name: "Emergency call-out" }, { name: "Bathroom install" }] }],
    integrations: [{ provider: "google-maps", purpose: "Service-area radius map", operations: ["render.map"], optional: false, requiredConfig: ["GOOGLE_MAPS_API_KEY"] }],
    contactRadius: { postcode: "B17 9AB", miles: 15 }
  });
}

// ============================================================================
// Scenario 6 · Missing information (NEX must refuse to invent)
// ============================================================================

export function scenario6_MissingInfo(): AppBlueprint {
  const bp = scenario5_ServiceBusinessPlumber();
  // Strip customer name + contact and mark them REQUIRED
  const p: Record<string, unknown> = { ...bp.provenance };
  delete p["identity.displayName"];
  const p2 = setRequired(p, "identity.displayName", "customer omitted");
  const p3 = setRequired(p2, "identity.contact.primaryPhone", "customer omitted");
  return {
    ...bp,
    id: "ab_p10_s6",
    name: "[Business Name]",
    identity: { ...bp.identity, displayName: "[Business Name]" },
    provenance: p3 as AppBlueprint["provenance"]
  };
}

// ============================================================================
// Scenario 7 · Conflicting information (style vs detail)
// ============================================================================

export function scenario7_Conflicting(): AppBlueprint {
  // Customer says "modern minimalist" archetype but imagery direction includes traditional-only terms.
  const pages = [
    page("home",    "/",        "Home",    [section("hero/simple-heading", { headline: "Modern minimalist studio" })]),
    page("about",   "/about",   "About",   [section("content/prose", {})]),
    page("contact", "/contact", "Contact", [section("contact/split", {})])
  ];
  const bp = makeBlueprint({
    id: "ab_p10_s7",
    name: "Sonder Interior Design",
    displayName: "Sonder Interior Design",
    taxonomySlug: "interior-designer",
    archetype: "modern",
    toneOfVoice: "premium",
    imageryDirection: ["victorian", "traditional", "grand", "rustic", "cottage"],   // contradicts "modern minimalist"
    pages
  });
  return bp;
}

// ============================================================================
// Scenario 8 · Changing requirements (two Blueprints, revision changes)
// ============================================================================

export function scenario8_Changing_v1(): AppBlueprint {
  const bp = scenario2_MultiPageKitchen();
  return { ...bp, id: "ab_p10_s8_v1", vertical: { ...bp.vertical, archetype: "modern" }, meta: { ...bp.meta, revision: 1 } };
}

export function scenario8_Changing_v2(): AppBlueprint {
  const bp = scenario2_MultiPageKitchen();
  return { ...bp, id: "ab_p10_s8_v2", vertical: { ...bp.vertical, archetype: "traditional" }, meta: { ...bp.meta, revision: 2 } };
}

// ============================================================================
// Scenario 9 · Bad / unclear request (vague vertical, empty intent)
// ============================================================================

export function scenario9_UnclearRequest(): AppBlueprint {
  const pages = [page("home", "/", "Home", [section("hero/simple-heading", {})])];
  const bp = makeBlueprint({
    id: "ab_p10_s9",
    name: "[Unknown Business]",
    displayName: "[Unknown Business]",
    taxonomySlug: "unknown-trade",   // Not in real trade taxonomy on purpose
    archetype: undefined,
    imageryDirection: [],
    pages
  });
  return {
    ...bp,
    provenance: {
      ...bp.provenance,
      "identity.displayName": { level: "REQUIRED", source: "blueprint:required", reason: "customer request too vague to derive name" },
      "vertical.taxonomySlug": { level: "INFERRED", source: "brain:default", confidence: 0.1, reason: "fallback · true vertical unclear" }
    }
  };
}

// ============================================================================
// Scenario 10 · Large website (16 pages, stress test)
// ============================================================================

export function scenario10_LargeWebsite(): AppBlueprint {
  const pageIds = [
    "home", "about", "team", "history",
    "services", "residential", "commercial", "restoration",
    "portfolio", "case-studies", "projects", "gallery",
    "process", "testimonials", "faq", "contact"
  ];
  const pages: PageSpec[] = pageIds.map((id, i) => {
    const title = id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    // Rotate section types across pages
    const s: SectionInstance[] = [];
    if (id === "home") s.push(section("hero/photo-full", { headline: "Rendering & masonry across the UK" }));
    else s.push(section("hero/simple-heading", { headline: title }));
    if (i % 3 === 0) s.push(section("gallery/grid", { columns: 3 }));
    if (i % 3 === 1) s.push(section("features/three-up", {}));
    if (i % 3 === 2) s.push(section("services/grid", {}, { data: { source: "services" } }));
    if (id === "contact") s.push(section("contact/split", {}));
    else s.push(section("cta/split-cta", {}));
    return page(id, id === "home" ? "/" : `/${id}`, title, s);
  });
  return makeBlueprint({
    id: "ab_p10_s10",
    name: "Blackwell Rendering & Masonry",
    displayName: "Blackwell Rendering & Masonry",
    taxonomySlug: "renderer",
    archetype: "traditional",
    toneOfVoice: "no-nonsense",
    primary: "#4b3a2b",
    pages,
    data: [{ id: "services", label: "Services", required: false, fields: [{ name: "name", kind: "text", required: true }, { name: "summary", kind: "text", required: true }], seed: [{ name: "Silicone render" }, { name: "K-Rend" }, { name: "Stone repair" }] }]
  });
}
