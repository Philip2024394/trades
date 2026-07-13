// Studio Editor catalogue.
//
// One source of truth for every item the Editor's right sidebar can
// offer. Each category surfaces a curated list of items with the SAME
// shape (id, name, description, thumbnailUrl?, previewSchematic?,
// searchKeywords[]) so the sidebar UI is generic and swaps by tab.

import { pickHeroForTrade, heroesForTrade } from "@/lib/heroLibrary";

export type EditorCategory = "container" | "hero" | "button" | "section";

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  category: EditorCategory;
  /** Optional image thumbnail (heroes). */
  thumbnailUrl?: string;
  /** Optional schematic tokens for containers (rendered as CSS grid). */
  schematic?: {
    rows: number;
    cols: number;
    /** Which cells to fill — 1 = filled, 0 = empty. Length = rows*cols. */
    grid: readonly number[];
  };
  /** Optional colour hint for buttons. */
  colorHint?: string;
  searchKeywords: string[];
  /** Payload that gets appended to the canvas when the item is added. */
  payload: {
    kind: EditorCategory;
    key: string;
    config?: Record<string, unknown>;
  };
};

// ─── Containers — different sizes / layouts ──────────────────
const CONTAINERS: CatalogItem[] = [
  {
    id: "container.single",
    name: "Single column",
    description: "Full-width single column. Use for hero, long-form copy, footer.",
    category: "container",
    schematic: { rows: 1, cols: 1, grid: [1] },
    searchKeywords: ["single", "column", "full", "hero", "wide", "long"],
    payload: { kind: "container", key: "containers.single-column" }
  },
  {
    id: "container.split-2",
    name: "Two-column split",
    description: "50/50 split. Text on one side, image on the other.",
    category: "container",
    schematic: { rows: 1, cols: 2, grid: [1, 1] },
    searchKeywords: ["two", "split", "half", "50/50", "text-image"],
    payload: { kind: "container", key: "containers.split-2" }
  },
  {
    id: "container.grid-3",
    name: "Three-column grid",
    description: "Three equal columns. Services, feature strip, team.",
    category: "container",
    schematic: { rows: 1, cols: 3, grid: [1, 1, 1] },
    searchKeywords: ["three", "grid", "trio", "services", "features"],
    payload: { kind: "container", key: "containers.grid-3" }
  },
  {
    id: "container.grid-4",
    name: "Four-column grid",
    description: "Compact four-across. Trust bar, product tiles.",
    category: "container",
    schematic: { rows: 1, cols: 4, grid: [1, 1, 1, 1] },
    searchKeywords: ["four", "grid", "quartet", "products", "trust-bar"],
    payload: { kind: "container", key: "containers.grid-4" }
  },
  {
    id: "container.sidebar-left",
    name: "Sidebar left",
    description: "Narrow sidebar + wide content. Reviews rail, filters.",
    category: "container",
    schematic: { rows: 1, cols: 4, grid: [1, 1, 1, 1] },
    searchKeywords: ["sidebar", "left", "reviews", "filters"],
    payload: { kind: "container", key: "containers.sidebar-left" }
  },
  {
    id: "container.sidebar-right",
    name: "Sidebar right",
    description: "Wide content + narrow sidebar. Booking, contact.",
    category: "container",
    schematic: { rows: 1, cols: 4, grid: [1, 1, 1, 1] },
    searchKeywords: ["sidebar", "right", "booking", "contact"],
    payload: { kind: "container", key: "containers.sidebar-right" }
  },
  {
    id: "container.hero",
    name: "Hero container",
    description: "Full-bleed hero shell with gradient overlay.",
    category: "container",
    schematic: { rows: 2, cols: 1, grid: [1, 1] },
    searchKeywords: ["hero", "banner", "full-bleed", "landing"],
    payload: { kind: "container", key: "containers.hero" }
  },
  {
    id: "container.masonry",
    name: "Masonry",
    description: "Pinterest-style variable heights. Portfolio, gallery.",
    category: "container",
    schematic: { rows: 3, cols: 3, grid: [1, 1, 1, 1, 0, 1, 1, 1, 1] },
    searchKeywords: ["masonry", "pinterest", "gallery", "portfolio"],
    payload: { kind: "container", key: "containers.masonry" }
  },
  {
    id: "container.timeline",
    name: "Timeline",
    description: "Chronological rail. Project milestones, before/after.",
    category: "container",
    schematic: { rows: 4, cols: 1, grid: [1, 1, 1, 1] },
    searchKeywords: ["timeline", "milestones", "history", "process"],
    payload: { kind: "container", key: "containers.timeline" }
  },
  {
    id: "container.pricing",
    name: "Pricing 3-tier",
    description: "Three columns with the middle one pinned as recommended.",
    category: "container",
    schematic: { rows: 1, cols: 3, grid: [1, 1, 1] },
    searchKeywords: ["pricing", "tier", "plan", "recommended"],
    payload: { kind: "container", key: "containers.pricing" }
  },
  {
    id: "container.card-2x2",
    name: "Card 2×2",
    description: "Four cards in a 2×2 grid.",
    category: "container",
    schematic: { rows: 2, cols: 2, grid: [1, 1, 1, 1] },
    searchKeywords: ["card", "grid", "2x2", "quartet"],
    payload: { kind: "container", key: "containers.card-2x2" }
  },
  {
    id: "container.wizard",
    name: "Wizard steps",
    description: "Stepped horizontal flow. Booking, onboarding.",
    category: "container",
    schematic: { rows: 1, cols: 5, grid: [1, 1, 1, 1, 1] },
    searchKeywords: ["wizard", "steps", "booking", "onboarding"],
    payload: { kind: "container", key: "containers.wizard" }
  }
];

// ─── Buttons — variants + intent + animation effects ─────────
const BUTTONS: CatalogItem[] = [
  {
    id: "button.primary",
    name: "Primary CTA",
    description: "Yellow-on-black. The main action.",
    category: "button",
    colorHint: "#FFB300",
    searchKeywords: ["primary", "cta", "main", "action", "yellow"],
    payload: {
      kind: "button", key: "button.primary",
      config: { label: "Get a Quote", variant: "primary" }
    }
  },
  {
    id: "button.secondary",
    name: "Secondary CTA",
    description: "Bordered ghost button. Supporting action.",
    category: "button",
    colorHint: "#FFFFFF",
    searchKeywords: ["secondary", "ghost", "outline", "bordered"],
    payload: {
      kind: "button", key: "button.secondary",
      config: { label: "See our work", variant: "secondary" }
    }
  },
  {
    id: "button.whatsapp",
    name: "WhatsApp CTA",
    description: "WhatsApp-green, opens chat with your number.",
    category: "button",
    colorHint: "#25D366",
    searchKeywords: ["whatsapp", "chat", "message"],
    payload: {
      kind: "button", key: "button.whatsapp",
      config: { label: "WhatsApp Us", variant: "whatsapp" }
    }
  },
  {
    id: "button.call",
    name: "Call CTA",
    description: "Tel: link with phone icon.",
    category: "button",
    colorHint: "#F59E0B",
    searchKeywords: ["call", "phone", "tel", "ring"],
    payload: {
      kind: "button", key: "button.call",
      config: { label: "Call Now", variant: "call" }
    }
  },
  {
    id: "button.book",
    name: "Book CTA",
    description: "Opens the booking flow.",
    category: "button",
    colorHint: "#0A0A0A",
    searchKeywords: ["book", "appointment", "slot", "calendar"],
    payload: {
      kind: "button", key: "button.book",
      config: { label: "Book Now", variant: "book" }
    }
  },
  {
    id: "button.quote",
    name: "Quote CTA",
    description: "Opens the quote workspace.",
    category: "button",
    colorHint: "#FFB300",
    searchKeywords: ["quote", "estimate", "price"],
    payload: {
      kind: "button", key: "button.quote",
      config: { label: "Get a Quote", variant: "quote" }
    }
  },
  {
    id: "button.email",
    name: "Email CTA",
    description: "Mailto: link with envelope icon.",
    category: "button",
    colorHint: "#3B82F6",
    searchKeywords: ["email", "mailto", "contact"],
    payload: {
      kind: "button", key: "button.email",
      config: { label: "Email Us", variant: "email" }
    }
  },
  {
    id: "button.floating-cta",
    name: "Floating CTA",
    description: "Sticky bottom-right, follows the visitor.",
    category: "button",
    colorHint: "#FFB300",
    searchKeywords: ["floating", "sticky", "bottom", "follow"],
    payload: {
      kind: "button", key: "button.floating-cta",
      config: { label: "Get a Quote", variant: "floating" }
    }
  },
  // ─── Animation-effect buttons ──────────────────────────
  {
    id: "button.pulse",
    name: "Pulse animation",
    description: "Pulsing yellow ring — attention-grabbing.",
    category: "button",
    colorHint: "#FFB300",
    searchKeywords: ["pulse", "animation", "attention", "beacon"],
    payload: { kind: "button", key: "button.pulse", config: { label: "Book Now", variant: "pulse" } }
  },
  {
    id: "button.glow",
    name: "Glow animation",
    description: "Yellow shadow glow that softly breathes.",
    category: "button",
    colorHint: "#FFB300",
    searchKeywords: ["glow", "animation", "shadow", "breathe"],
    payload: { kind: "button", key: "button.glow", config: { label: "Get Started", variant: "glow" } }
  },
  {
    id: "button.ripple",
    name: "Ripple on click",
    description: "Material-style ripple on click.",
    category: "button",
    colorHint: "#0A0A0A",
    searchKeywords: ["ripple", "material", "wave", "click"],
    payload: { kind: "button", key: "button.ripple", config: { label: "Continue", variant: "ripple" } }
  },
  {
    id: "button.slide-fill",
    name: "Slide fill on hover",
    description: "Yellow fill slides in from the left on hover.",
    category: "button",
    colorHint: "#FFFFFF",
    searchKeywords: ["slide", "fill", "hover", "animation"],
    payload: { kind: "button", key: "button.slide-fill", config: { label: "Learn More", variant: "slide-fill" } }
  },
  {
    id: "button.underline-sweep",
    name: "Underline sweep",
    description: "Underline sweeps in on hover — text-style CTA.",
    category: "button",
    colorHint: "#0A0A0A",
    searchKeywords: ["underline", "sweep", "text-style", "minimal"],
    payload: { kind: "button", key: "button.underline-sweep", config: { label: "Read More", variant: "underline-sweep" } }
  },
  // ─── Shape variants ──────────────────────────────
  { id: "button.pill", name: "Pill", description: "Fully-rounded pill shape.",
    category: "button", colorHint: "#FFB300",
    searchKeywords: ["pill", "rounded", "shape"],
    payload: { kind: "button", key: "button.pill", config: { label: "Continue", variant: "pill" } } },
  { id: "button.square", name: "Square", description: "Sharp corners, no radius.",
    category: "button", colorHint: "#0A0A0A",
    searchKeywords: ["square", "sharp", "brutalist"],
    payload: { kind: "button", key: "button.square", config: { label: "Submit", variant: "square" } } },
  { id: "button.chip", name: "Chip",
    description: "Compact chip — filter / tag style.",
    category: "button", colorHint: "#F1F5F9",
    searchKeywords: ["chip", "tag", "filter"],
    payload: { kind: "button", key: "button.chip", config: { label: "Manchester", variant: "chip" } } },
  { id: "button.tab", name: "Tab", description: "Underlined tab-style button.",
    category: "button", colorHint: "#FFFFFF",
    searchKeywords: ["tab", "nav", "underline"],
    payload: { kind: "button", key: "button.tab", config: { label: "Overview", variant: "tab" } } },
  // ─── Icon-only ───────────────────────────────────
  { id: "button.icon-circle", name: "Icon circle", description: "Round icon-only button.",
    category: "button", colorHint: "#FFB300",
    searchKeywords: ["icon", "round", "circle"],
    payload: { kind: "button", key: "button.icon-circle", config: { variant: "icon-circle" } } },
  { id: "button.icon-square", name: "Icon square", description: "Rounded-square icon-only.",
    category: "button", colorHint: "#0A0A0A",
    searchKeywords: ["icon", "square", "compact"],
    payload: { kind: "button", key: "button.icon-square", config: { variant: "icon-square" } } },
  // ─── Compound ────────────────────────────────────
  { id: "button.with-badge", name: "With badge",
    description: "Button with a red notification badge.",
    category: "button", colorHint: "#0A0A0A",
    searchKeywords: ["badge", "notification", "compound"],
    payload: { kind: "button", key: "button.with-badge", config: { label: "Inbox", variant: "with-badge" } } },
  { id: "button.two-line", name: "Two-line label",
    description: "Big label + small subtext.",
    category: "button", colorHint: "#0A0A0A",
    searchKeywords: ["two-line", "subtext", "compound"],
    payload: { kind: "button", key: "button.two-line", config: { label: "Book Now", variant: "two-line" } } },
  { id: "button.split", name: "Split button",
    description: "Main action + dropdown arrow.",
    category: "button", colorHint: "#FFB300",
    searchKeywords: ["split", "dropdown", "compound"],
    payload: { kind: "button", key: "button.split", config: { label: "Save", variant: "split" } } },
  // ─── Special / decorative ────────────────────────
  { id: "button.gradient", name: "Gradient",
    description: "Yellow → amber gradient fill.",
    category: "button", colorHint: "#FFB300",
    searchKeywords: ["gradient", "colourful", "premium"],
    payload: { kind: "button", key: "button.gradient", config: { label: "Try Premium", variant: "gradient" } } },
  { id: "button.glass", name: "Glass-morphism",
    description: "Frosted glass effect. Sits over an image.",
    category: "button", colorHint: "#FFFFFF",
    searchKeywords: ["glass", "morphism", "frost"],
    payload: { kind: "button", key: "button.glass", config: { label: "Explore", variant: "glass" } } },
  { id: "button.neumorph", name: "Neumorphism",
    description: "Soft shadow neumorphic button.",
    category: "button", colorHint: "#E2E8F0",
    searchKeywords: ["neumorphism", "soft", "shadow"],
    payload: { kind: "button", key: "button.neumorph", config: { label: "Click", variant: "neumorph" } } },
  // ─── Sizes ───────────────────────────────────────
  { id: "button.xs", name: "Extra small",
    description: "20-px height — compact, dense UIs.",
    category: "button", colorHint: "#FFB300",
    searchKeywords: ["xs", "small", "tiny"],
    payload: { kind: "button", key: "button.xs", config: { label: "OK", variant: "xs" } } },
  { id: "button.lg", name: "Large",
    description: "48-px hero-scale CTA.",
    category: "button", colorHint: "#0A0A0A",
    searchKeywords: ["lg", "large", "hero"],
    payload: { kind: "button", key: "button.lg", config: { label: "Get Started", variant: "lg" } } }
];

// ─── Extra curated sections ───────────────────────────────────
// Six new categories the user asked for on 2026-07-09. These render
// as tiles in the Sections tab (they don't require registry entries;
// the editor treats them as first-class catalog items).
const EXTRA_SECTIONS: CatalogItem[] = [
  // ─── Running text / marquee ─────────────────────────
  {
    id: "section.marquee-single",
    name: "Marquee — single line",
    description: "Yellow bar with scrolling headline. Great for offers.",
    category: "section",
    searchKeywords: ["marquee", "running", "ticker", "scroll", "banner"],
    payload: { kind: "section", key: "section.marquee-single" }
  },
  {
    id: "section.marquee-logos",
    name: "Marquee — trust logos",
    description: "Scrolling row of accreditation + brand logos.",
    category: "section",
    searchKeywords: ["marquee", "logos", "trust", "brands", "scroll"],
    payload: { kind: "section", key: "section.marquee-logos" }
  },
  {
    id: "section.ticker-reviews",
    name: "Ticker — live reviews",
    description: "Scrolling ticker of recent 5-star reviews.",
    category: "section",
    searchKeywords: ["ticker", "reviews", "live", "scroll"],
    payload: { kind: "section", key: "section.ticker-reviews" }
  },

  // ─── Product category rail ─────────────────────────
  {
    id: "section.product-category-rail",
    name: "Product category rail",
    description: "Horizontally scrolling category chips with icons.",
    category: "section",
    searchKeywords: ["product", "category", "rail", "shop", "carousel"],
    payload: { kind: "section", key: "section.product-category-rail" }
  },
  {
    id: "section.product-grid-scroll",
    name: "Product grid — scroll",
    description: "Horizontal product cards with ref numbers + prices.",
    category: "section",
    searchKeywords: ["product", "grid", "scroll", "shop"],
    payload: { kind: "section", key: "section.product-grid-scroll" }
  },

  // ─── Header variants ───────────────────────────────
  {
    id: "section.header-sticky",
    name: "Header — sticky top",
    description: "White sticky bar with logo, nav, CTA.",
    category: "section",
    searchKeywords: ["header", "nav", "sticky", "top"],
    payload: { kind: "section", key: "section.header-sticky" }
  },
  {
    id: "section.header-transparent",
    name: "Header — transparent",
    description: "Transparent over the hero, solid on scroll.",
    category: "section",
    searchKeywords: ["header", "nav", "transparent", "overlay"],
    payload: { kind: "section", key: "section.header-transparent" }
  },
  {
    id: "section.header-mega",
    name: "Header — mega menu",
    description: "Full-width dropdown with columns of links.",
    category: "section",
    searchKeywords: ["header", "nav", "mega", "menu", "dropdown"],
    payload: { kind: "section", key: "section.header-mega" }
  },
  {
    id: "section.header-floating",
    name: "Header — floating pill",
    description: "Rounded pill nav floating above the hero.",
    category: "section",
    searchKeywords: ["header", "nav", "floating", "pill"],
    payload: { kind: "section", key: "section.header-floating" }
  },
  { id: "section.header-links", name: "Header — text links row",
    description: "Logo + Home / Services / About / Contact + phone.",
    category: "section", searchKeywords: ["header", "nav", "links", "text"],
    payload: { kind: "section", key: "section.header-links" } },
  { id: "section.header-burger", name: "Header — burger menu",
    description: "Logo + hamburger with drop-down slide.",
    category: "section", searchKeywords: ["header", "burger", "hamburger", "dropdown", "mobile"],
    payload: { kind: "section", key: "section.header-burger" } },
  { id: "section.header-cart", name: "Header — with cart",
    description: "Logo + nav + cart icon with counter.",
    category: "section", searchKeywords: ["header", "cart", "ecommerce", "shop"],
    payload: { kind: "section", key: "section.header-cart" } },
  { id: "section.header-signin", name: "Header — sign in / user",
    description: "Logo + nav + Sign In button (or user avatar).",
    category: "section", searchKeywords: ["header", "signin", "login", "user", "avatar"],
    payload: { kind: "section", key: "section.header-signin" } },
  { id: "section.header-search", name: "Header — with search bar",
    description: "Logo + centered search input + nav icons.",
    category: "section", searchKeywords: ["header", "search", "input"],
    payload: { kind: "section", key: "section.header-search" } },

  // ─── Image gallery / carousel effects ───────────────
  {
    id: "section.carousel-fade",
    name: "Carousel — fade",
    description: "Full-bleed images that fade between each other.",
    category: "section",
    searchKeywords: ["carousel", "gallery", "fade", "slideshow"],
    payload: { kind: "section", key: "section.carousel-fade" }
  },
  {
    id: "section.carousel-slide",
    name: "Carousel — slide",
    description: "Classic slide-left/right carousel with dots.",
    category: "section",
    searchKeywords: ["carousel", "gallery", "slide", "swipe"],
    payload: { kind: "section", key: "section.carousel-slide" }
  },
  {
    id: "section.carousel-coverflow",
    name: "Carousel — cover flow",
    description: "3D perspective, tilted side cards.",
    category: "section",
    searchKeywords: ["carousel", "coverflow", "3d", "perspective"],
    payload: { kind: "section", key: "section.carousel-coverflow" }
  },
  {
    id: "section.carousel-zoom",
    name: "Carousel — zoom-in",
    description: "Ken Burns zoom on each slide.",
    category: "section",
    searchKeywords: ["carousel", "zoom", "ken-burns", "cinematic"],
    payload: { kind: "section", key: "section.carousel-zoom" }
  },
  {
    id: "section.gallery-lightbox",
    name: "Gallery — lightbox grid",
    description: "Grid of thumbnails opening a full-screen lightbox.",
    category: "section",
    searchKeywords: ["gallery", "lightbox", "grid", "portfolio"],
    payload: { kind: "section", key: "section.gallery-lightbox" }
  },
  {
    id: "section.gallery-beforeafter",
    name: "Gallery — before/after slider",
    description: "Drag the divider to reveal before + after.",
    category: "section",
    searchKeywords: ["gallery", "before-after", "slider", "transformation"],
    payload: { kind: "section", key: "section.gallery-beforeafter" }
  },

  // ─── Hero text-layout variants ─────────────────────
  {
    id: "section.hero-text-left",
    name: "Hero — text left, image right",
    description: "Copy on the left, hero photo on the right.",
    category: "section",
    searchKeywords: ["hero", "left", "text", "split"],
    payload: { kind: "section", key: "section.hero-text-left" }
  },
  {
    id: "section.hero-text-center",
    name: "Hero — text centered",
    description: "Copy centered over a full-bleed background.",
    category: "section",
    searchKeywords: ["hero", "center", "text", "centred"],
    payload: { kind: "section", key: "section.hero-text-center" }
  },
  {
    id: "section.hero-text-bottom",
    name: "Hero — text bottom-left",
    description: "Text anchored to the bottom-left, magazine style.",
    category: "section",
    searchKeywords: ["hero", "bottom", "left", "editorial", "magazine"],
    payload: { kind: "section", key: "section.hero-text-bottom" }
  },
  {
    id: "section.hero-text-floating",
    name: "Hero — floating card",
    description: "Copy inside a floating white card over the image.",
    category: "section",
    searchKeywords: ["hero", "floating", "card", "premium"],
    payload: { kind: "section", key: "section.hero-text-floating" }
  },
  {
    id: "section.hero-video-bg",
    name: "Hero — video background",
    description: "Autoplay muted video behind the copy.",
    category: "section",
    searchKeywords: ["hero", "video", "background", "cinematic"],
    payload: { kind: "section", key: "section.hero-video-bg" }
  },

  // ─── Search ────────────────────────────────────────
  { id: "section.search-global", name: "Global search", description: "Full-width search bar with recent + suggested.",
    category: "section", searchKeywords: ["search", "global", "bar"],
    payload: { kind: "section", key: "section.search-global" } },
  { id: "section.search-location", name: "Location search", description: "Postcode + trade selector combo.",
    category: "section", searchKeywords: ["search", "location", "postcode"],
    payload: { kind: "section", key: "section.search-location" } },
  { id: "section.search-autocomplete", name: "Live autocomplete", description: "Search with drop-down suggestions.",
    category: "section", searchKeywords: ["search", "autocomplete", "typeahead"],
    payload: { kind: "section", key: "section.search-autocomplete" } },
  { id: "section.search-ai", name: "AI search", description: "Ask anything — natural-language input.",
    category: "section", searchKeywords: ["search", "ai", "natural-language"],
    payload: { kind: "section", key: "section.search-ai" } },

  // ─── Booking ───────────────────────────────────────
  { id: "section.booking-calendar", name: "Booking — calendar", description: "Month calendar with available dates highlighted.",
    category: "section", searchKeywords: ["booking", "calendar", "date"],
    payload: { kind: "section", key: "section.booking-calendar" } },
  { id: "section.booking-slots", name: "Booking — time slots", description: "Grid of morning / afternoon / evening slots.",
    category: "section", searchKeywords: ["booking", "slots", "time"],
    payload: { kind: "section", key: "section.booking-slots" } },
  { id: "section.booking-quote", name: "Quote request", description: "Multi-step quote wizard with progress dots.",
    category: "section", searchKeywords: ["booking", "quote", "wizard"],
    payload: { kind: "section", key: "section.booking-quote" } },

  // ─── Ecommerce ─────────────────────────────────────
  { id: "section.ecom-variants", name: "Product variants", description: "Size + colour + quantity variant chips.",
    category: "section", searchKeywords: ["ecom", "product", "variants"],
    payload: { kind: "section", key: "section.ecom-variants" } },
  { id: "section.ecom-add-cart", name: "Add to cart bar", description: "Sticky bottom bar with price + Add to Cart.",
    category: "section", searchKeywords: ["ecom", "cart", "add"],
    payload: { kind: "section", key: "section.ecom-add-cart" } },
  { id: "section.ecom-related", name: "Related products", description: "Horizontal row of related product cards.",
    category: "section", searchKeywords: ["ecom", "related", "cross-sell"],
    payload: { kind: "section", key: "section.ecom-related" } },

  // ─── Restaurant ────────────────────────────────────
  { id: "section.food-menu", name: "Digital menu", description: "Menu with photo, name, price, dietary tags.",
    category: "section", searchKeywords: ["food", "menu", "restaurant"],
    payload: { kind: "section", key: "section.food-menu" } },
  { id: "section.food-combos", name: "Combo offers", description: "Featured meal combos with savings.",
    category: "section", searchKeywords: ["food", "combo", "meal"],
    payload: { kind: "section", key: "section.food-combos" } },

  // ─── Ride hailing ──────────────────────────────────
  { id: "section.ride-pickup", name: "Pickup / drop-off", description: "From / to address inputs with map preview.",
    category: "section", searchKeywords: ["ride", "pickup", "map"],
    payload: { kind: "section", key: "section.ride-pickup" } },
  { id: "section.ride-driver", name: "Driver nearby", description: "Live map with driver dots + ETA badge.",
    category: "section", searchKeywords: ["ride", "driver", "eta"],
    payload: { kind: "section", key: "section.ride-driver" } },

  // ─── Auth ──────────────────────────────────────────
  { id: "section.auth-login", name: "Login form", description: "Email + password with social sign-in row.",
    category: "section", searchKeywords: ["auth", "login", "signin"],
    payload: { kind: "section", key: "section.auth-login" } },
  { id: "section.auth-otp", name: "OTP verify", description: "6-digit code input with resend timer.",
    category: "section", searchKeywords: ["auth", "otp", "code"],
    payload: { kind: "section", key: "section.auth-otp" } },

  // ─── Chat ──────────────────────────────────────────
  { id: "section.chat-live", name: "Live chat", description: "Messenger-style thread with typing indicator.",
    category: "section", searchKeywords: ["chat", "live", "message"],
    payload: { kind: "section", key: "section.chat-live" } },
  { id: "section.chat-ai", name: "AI chat", description: "Ask-anything chat with structured replies.",
    category: "section", searchKeywords: ["chat", "ai", "assistant"],
    payload: { kind: "section", key: "section.chat-ai" } },

  // ─── Empty states ──────────────────────────────────
  { id: "section.empty-orders", name: "Empty — no orders", description: "Illustration + call to browse.",
    category: "section", searchKeywords: ["empty", "orders", "state"],
    payload: { kind: "section", key: "section.empty-orders" } },
  { id: "section.empty-messages", name: "Empty — no messages", description: "Illustration + start chatting CTA.",
    category: "section", searchKeywords: ["empty", "messages", "state"],
    payload: { kind: "section", key: "section.empty-messages" } },
  { id: "section.empty-error", name: "Error state", description: "404-style with retry button.",
    category: "section", searchKeywords: ["error", "404", "state"],
    payload: { kind: "section", key: "section.empty-error" } },

  // ─── Footer ────────────────────────────────────────
  { id: "section.footer-full", name: "Footer — full", description: "4-column footer with links + socials + newsletter.",
    category: "section", searchKeywords: ["footer", "full"],
    payload: { kind: "section", key: "section.footer-full" } },
  { id: "section.footer-minimal", name: "Footer — minimal", description: "Single row with logo + legal + socials.",
    category: "section", searchKeywords: ["footer", "minimal", "compact"],
    payload: { kind: "section", key: "section.footer-minimal" } },
  { id: "section.footer-appstore", name: "Footer — app store CTA", description: "Get it on iOS / Android badges.",
    category: "section", searchKeywords: ["footer", "app", "download"],
    payload: { kind: "section", key: "section.footer-appstore" } },

  // ─── Features + services + banners + bottom nav (added 2026-07-09 from Woodcraft template) ───
  { id: "section.social-proof-avatars", name: "Social proof — avatars + count",
    description: "3 overlapping avatars + \"500+ Happy Customers\" label.",
    category: "section", searchKeywords: ["social", "proof", "avatars", "customers", "trust"],
    payload: { kind: "section", key: "section.social-proof-avatars" } },
  { id: "section.search-card-hero", name: "Search card — floating over hero",
    description: "White rounded card with heading + 2 side-by-side inputs + Search button.",
    category: "section", searchKeywords: ["search", "card", "hero", "float", "location", "service"],
    payload: { kind: "section", key: "section.search-card-hero" } },
  { id: "section.services-4-image-row", name: "Services — 4 image cards row",
    description: "Horizontally scrolling row of 4 service cards with photo + icon + title + desc.",
    category: "section", searchKeywords: ["services", "cards", "row", "popular", "horizontal"],
    payload: { kind: "section", key: "section.services-4-image-row" } },
  { id: "section.features-4-icons-circle", name: "Features — 4 icon circles",
    description: "Row of 4 features each with a circular icon background + label.",
    category: "section", searchKeywords: ["features", "trust", "icons", "circle", "row"],
    payload: { kind: "section", key: "section.features-4-icons-circle" } },
  { id: "section.services-4-image-cards", name: "Services — 2×2 image cards",
    description: "Grid of 4 service cards with photo, icon overlay, title, description.",
    category: "section", searchKeywords: ["services", "cards", "grid", "popular", "image"],
    payload: { kind: "section", key: "section.services-4-image-cards" } },
  { id: "section.guarantee-banner", name: "Guarantee banner",
    description: "Dark card with shield icon + copy on left, 100% satisfaction seal on right.",
    category: "section", searchKeywords: ["guarantee", "banner", "trust", "quality", "satisfaction"],
    payload: { kind: "section", key: "section.guarantee-banner" } },
  { id: "section.bottom-nav-fab", name: "Bottom nav with FAB",
    description: "5-tab bottom nav with a floating action button in the centre.",
    category: "section", searchKeywords: ["nav", "bottom", "tab", "fab", "footer", "mobile"],
    payload: { kind: "section", key: "section.bottom-nav-fab" } },

  // ─── Multi-page templates: gallery + contact ───────
  { id: "section.page-header-strip", name: "Page title strip",
    description: "Small page heading + subhead for interior pages (Gallery, Contact, About).",
    category: "section", searchKeywords: ["page", "title", "strip", "header", "heading"],
    payload: { kind: "section", key: "section.page-header-strip" } },
  { id: "section.gallery-grid-priced", name: "Gallery grid — priced",
    description: "2-column tile grid: photo + title + description + price.",
    category: "section", searchKeywords: ["gallery", "grid", "priced", "portfolio", "work"],
    payload: { kind: "section", key: "section.gallery-grid-priced" } },
  { id: "section.contact-form", name: "Contact form",
    description: "Name / email / phone / message form with WhatsApp submit.",
    category: "section", searchKeywords: ["contact", "form", "message", "enquiry", "whatsapp"],
    payload: { kind: "section", key: "section.contact-form" } },
  { id: "section.contact-details", name: "Contact details strip",
    description: "Phone / email / address / hours icon rows.",
    category: "section", searchKeywords: ["contact", "details", "phone", "email", "address", "hours"],
    payload: { kind: "section", key: "section.contact-details" } },

  // ─── Loyalty / Payments / Analytics / Blog ─────────
  { id: "section.loyalty-points", name: "Loyalty points card", description: "Points balance + progress to next reward.",
    category: "section", searchKeywords: ["loyalty", "points", "rewards"],
    payload: { kind: "section", key: "section.loyalty-points" } },
  { id: "section.payments-row", name: "Payment methods", description: "Row of Stripe / PayPal / Apple Pay logos.",
    category: "section", searchKeywords: ["payments", "methods", "checkout"],
    payload: { kind: "section", key: "section.payments-row" } },
  { id: "section.analytics-kpi", name: "KPI cards", description: "3-card row of revenue / users / conversions.",
    category: "section", searchKeywords: ["analytics", "kpi", "dashboard"],
    payload: { kind: "section", key: "section.analytics-kpi" } },
  { id: "section.blog-featured", name: "Blog — featured", description: "Hero article + 2 supporting cards.",
    category: "section", searchKeywords: ["blog", "featured", "articles"],
    payload: { kind: "section", key: "section.blog-featured" } }
];

// ─── Heroes — hero library, tagged by trade ──────────────────
export function loadHeroCatalog(): CatalogItem[] {
  // heroesForTrade("") returns nothing (empty slug), so we iterate a
  // wide list of trades and dedupe by URL. Fine for a curated list of
  // ~107 heroes.
  const seenUrls = new Set<string>();
  const items: CatalogItem[] = [];
  const seedTrades = [
    "*", "plumber", "electrician", "gas-engineer", "roofer", "carpenter",
    "joiner", "painter", "tiler", "plasterer", "kitchen-fitter",
    "bathroom-fitter", "landscaper", "general-builder", "bricklayer",
    "stonemason", "groundworker", "scaffolder", "building-merchant",
    "builders-supplies", "tool-hire", "chimney-sweep", "hvac-contractor"
  ];
  for (const trade of seedTrades) {
    const heroes = heroesForTrade(trade);
    for (const h of heroes) {
      const entry = h.entry;
      if (seenUrls.has(entry.image_url)) continue;
      seenUrls.add(entry.image_url);
      items.push({
        id: `hero.${entry.id}`,
        name: entry.subject.slice(0, 60),
        description: entry.hero_use_case?.slice(0, 120) ?? entry.vibe,
        category: "hero",
        thumbnailUrl: entry.image_url,
        searchKeywords: [
          ...(entry.keywords_strict ?? []),
          entry.vibe.split(/[/\s]+/).filter(Boolean).slice(0, 3).join(" "),
          entry.recommended_use ?? ""
        ].filter(Boolean),
        payload: {
          kind: "hero",
          key: entry.id,
          config: {
            imageUrl: entry.image_url,
            palette: entry.theme_palette,
            textZone: entry.text_zone
          }
        }
      });
    }
  }
  return items;
}

// ─── Sections — the full sectionRegistry ─────────────────────
export function loadSectionCatalog(
  sectionsList: { id: string; name?: string; category?: string; description?: string; bestForVerticals?: readonly string[] }[]
): CatalogItem[] {
  const fromRegistry = sectionsList.map((s) => ({
    id: `section.${s.id}`,
    name: s.name ?? s.id,
    description: s.description ?? s.category ?? "Section",
    category: "section" as EditorCategory,
    searchKeywords: [
      s.id,
      s.category ?? "",
      ...(s.bestForVerticals ?? [])
    ].filter(Boolean),
    payload: { kind: "section" as EditorCategory, key: s.id }
  }));
  // Merge curated extras before registry entries so they show first.
  return [...EXTRA_SECTIONS, ...fromRegistry];
}

export function loadContainerCatalog(): CatalogItem[] {
  return CONTAINERS;
}

export function loadButtonCatalog(): CatalogItem[] {
  return BUTTONS;
}

/** Convenience — full catalogue in one call. Heroes + sections need
 *  the registry loaded so they're separate calls. */
export function loadCatalog(sectionsList: Parameters<typeof loadSectionCatalog>[0]): {
  containers: CatalogItem[];
  heroes: CatalogItem[];
  buttons: CatalogItem[];
  sections: CatalogItem[];
} {
  return {
    containers: loadContainerCatalog(),
    heroes: loadHeroCatalog(),
    buttons: loadButtonCatalog(),
    sections: loadSectionCatalog(sectionsList)
  };
}

/** Look up the primary trade for a hero to prefer it in category
 *  narrowing. Falls back to the first keyword_strict. */
export function primaryTradeFor(item: CatalogItem): string | null {
  if (item.category !== "hero") return null;
  return item.searchKeywords[0] ?? null;
}

/** Pick a starter hero for a trade (used when the user drops a Hero
 *  container onto the canvas without a specific banner). */
export function starterHeroForTrade(tradeSlug: string): { url: string; palette: unknown } | null {
  const pick = pickHeroForTrade(tradeSlug);
  if (!pick) return null;
  return {
    url: pick.entry.image_url,
    palette: pick.entry.theme_palette
  };
}
