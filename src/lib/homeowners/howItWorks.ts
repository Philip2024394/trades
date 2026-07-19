// "How it works" — canonical SiteBook feature manifest.
//
// One source of truth for the in-page guide, deep-links, section
// chips, and future SEO help pages. Each entry powers three surfaces:
//   1. HowItWorksCard         — expandable card in the guide grid
//   2. HowItWorksTour         — driver.js live spotlight tour on the
//                                actual page elements
//   3. Deep-link ?guide=<id>  — arrives on card + optional autoplay
//
// SVG previews are inline (no image assets to ship). Each preview is
// a wireframe of the relevant UI region with a yellow highlight on
// the exact element the feature is about. Renders sharp at any DPI,
// ~1kb per feature, brand-aligned.
//
// Tour selectors point at REAL DOM elements. When wiring a page to
// this system, use `data-tour="{selector}"` attributes rather than
// class hooks so refactors don't silently break tours.

export type GuideSection = "inbox" | "composer" | "feed" | "profile" | "trades";

export type GuideStep = {
  /** CSS selector on the live page (prefer [data-tour="…"]) */
  element:  string;
  title:    string;
  body:     string;
  side?:    "top" | "bottom" | "left" | "right";
  align?:   "start" | "center" | "end";
};

export type GuideFeature = {
  id:            string;
  section:       GuideSection;
  sectionLabel:  string;
  title:         string;
  oneLiner:      string;
  /** Inline SVG (viewBox 0 0 240 120). Yellow region = the element
   *  this feature is about. Rest is monochrome wireframe. */
  previewSvg:    string;
  clickPath:     string[];
  deepBody:      string;
  tourSteps:     GuideStep[];    // may be empty when no live tour exists yet
  /** True when the feature is fully wired in production. Draft
   *  features render with a "coming soon" chip on their card. */
  live?:         boolean;
};

// ─── SVG helpers ─────────────────────────────────────────────────────
// Choreographed animated preview: cursor moves from a rest position
// to the target region, then pulses a click ring on arrival. Whole
// cycle loops every 4.5s. Everything is inline SVG (SMIL animations),
// no JS, no assets — ~2kb per preview, renders sharp at every DPI,
// and feels alive without WebM overhead.

const svgWireframe = (highlight: {
  x: number; y: number; w: number; h: number;
  label?: string;
}, extra?: string): string => {
  // Cursor rest position — bottom-right of the frame, moves to the
  // centre of the highlighted region. Target coords are the highlight
  // centre offset slightly so the pointer tip lands cleanly on the
  // element (not centred on it).
  const targetX = highlight.x + highlight.w / 2 - 2;
  const targetY = highlight.y + highlight.h / 2 - 2;
  const restX   = 210;
  const restY   = 105;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" aria-hidden="true">
  <defs>
    <filter id="tn-cursor-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0.5" dy="1" stdDeviation="0.6" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="240" height="120" fill="#FBF6EC"/>

  <!-- outer app frame -->
  <rect x="6" y="6" width="228" height="18" rx="3" fill="#fff" stroke="#EDE4CE" stroke-width="1"/>
  <circle cx="16" cy="15" r="4" fill="#FFB300"/>
  <rect x="24" y="12" width="42" height="6" rx="1" fill="#0A0A0A"/>

  <!-- 3-column layout -->
  <rect x="6" y="28" width="70" height="86" rx="3" fill="#fff" stroke="#EDE4CE"/>
  <rect x="80" y="28" width="90" height="86" rx="3" fill="#fff" stroke="#EDE4CE"/>
  <rect x="174" y="28" width="60" height="86" rx="3" fill="#fff" stroke="#EDE4CE"/>
  ${extra ?? ""}

  <!-- Target region highlight — glows brighter when the cursor arrives -->
  <rect x="${highlight.x}" y="${highlight.y}" width="${highlight.w}" height="${highlight.h}"
        fill="#FFB300" stroke="#FFB300" stroke-width="1.5" rx="3">
    <animate attributeName="fill-opacity"
             values="0.15; 0.15; 0.55; 0.55; 0.15"
             keyTimes="0; 0.55; 0.72; 0.88; 1"
             dur="4.5s" repeatCount="indefinite"/>
  </rect>

  ${highlight.label ? `<text x="${highlight.x + highlight.w / 2}" y="${highlight.y + highlight.h / 2 + 3}"
        text-anchor="middle" font-family="system-ui, sans-serif" font-size="6" font-weight="900"
        fill="#0A0A0A">${highlight.label}</text>` : ""}

  <!-- Click pulse ring — expands briefly when cursor arrives at target -->
  <circle cx="${targetX}" cy="${targetY}" r="2" fill="none" stroke="#FFB300" stroke-width="1.5">
    <animate attributeName="r"
             values="0; 0; 0; 12; 12"
             keyTimes="0; 0.55; 0.72; 0.88; 1"
             dur="4.5s" repeatCount="indefinite"/>
    <animate attributeName="stroke-opacity"
             values="0; 0; 1; 0; 0"
             keyTimes="0; 0.55; 0.72; 0.88; 1"
             dur="4.5s" repeatCount="indefinite"/>
  </circle>

  <!-- Cursor pointer — moves from rest to target, then back -->
  <g filter="url(#tn-cursor-shadow)">
    <path d="M0 0 L0 9 L2.5 7 L4.2 10.5 L5.7 9.8 L4 6.3 L7 6.3 Z"
          fill="#0A0A0A" stroke="#fff" stroke-width="0.6" stroke-linejoin="round">
      <animateTransform attributeName="transform" type="translate"
                        values="${restX} ${restY}; ${restX} ${restY}; ${targetX} ${targetY}; ${targetX} ${targetY}; ${restX} ${restY}"
                        keyTimes="0; 0.15; 0.55; 0.85; 1"
                        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
                        calcMode="spline"
                        dur="4.5s" repeatCount="indefinite"/>
    </path>
  </g>
</svg>`.trim();
};

// ─── Feature manifest ────────────────────────────────────────────────

export const HOW_IT_WORKS_FEATURES: GuideFeature[] = [
  // ── LEFT PANEL — Trades & Suppliers ────────────────────────────────
  {
    id:           "search-project",
    section:      "inbox",
    sectionLabel: "Left panel · Trades & Suppliers",
    title:        "Find any trade fast",
    oneLiner:     "Type the project name, address or trade type to narrow the list.",
    previewSvg:   svgWireframe({ x: 10, y: 46, w: 62, h: 8, label: "search" }),
    clickPath:    ["Left panel", "Search field", "Type project name"],
    deepBody:     "The search input on your Trades & Suppliers panel matches against four things at once: the project title, the project city, the trade name, and the last message body. So typing 'en-suite' narrows to every trade on that project; typing 'plumber' finds anyone with that trade; typing 'manchester' shows everything in that city. One field handles them all — no dropdowns to configure.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='inbox-search']", title: "Search project", body: "Type the project name, address, trade or a message keyword. The list narrows live as you type.", side: "right" }
    ]
  },
  {
    id:           "message-a-trade",
    section:      "inbox",
    sectionLabel: "Left panel · Trades & Suppliers",
    title:        "Message a trade on WhatsApp",
    oneLiner:     "Tap a conversation → compose here → WhatsApp opens pre-filled.",
    previewSvg:   svgWireframe({ x: 10, y: 66, w: 62, h: 14, label: "row" }),
    clickPath:    ["Left panel", "Pick a conversation", "Compose", "Send via WhatsApp"],
    deepBody:     "Every message is written INSIDE your SiteBook first, then WhatsApp opens with the text pre-filled. You hit send in WhatsApp — but the outgoing copy is captured 100% on the SiteBook side (that's why the record is authoritative even though WhatsApp is end-to-end encrypted). Templates on the composer keep the ask short and clear.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='inbox-row']",     title: "Pick a thread", body: "Every row is one WhatsApp conversation with a trade or supplier on one of your projects.", side: "right" },
      { element: "[data-tour='wa-composer']",   title: "Compose here",  body: "Pick a template or write custom. This copy is saved to SiteBook before WhatsApp opens.", side: "top" }
    ]
  },
  {
    id:           "reply-link",
    section:      "inbox",
    sectionLabel: "Left panel · Trades & Suppliers",
    title:        "Their reply comes back to you",
    oneLiner:     "Every message includes a nw.app/r/ link — trades tap it to reply, and their reply lands on the same thread.",
    previewSvg:   svgWireframe({ x: 84, y: 60, w: 82, h: 22, label: "reply" }),
    clickPath:    ["Trade opens WhatsApp", "Taps nw.app/r/… link", "Types reply", "You get it on the same thread"],
    deepBody:     "Because WhatsApp is encrypted, we can't intercept messages. So every outgoing WhatsApp message from your SiteBook has a footer with a short link like nw.app/r/AbC123. When your trade taps it, they get a simple reply page (no login needed), type back, and their reply lands as an 'inbound' message on the exact same thread in your SiteBook. Both sides of the conversation, one record.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='inbox-row']", title: "Same thread", body: "Trade replies via the link land here, chronologically under your outgoing message.", side: "right" }
    ]
  },
  {
    id:           "close-conversation",
    section:      "inbox",
    sectionLabel: "Left panel · Trades & Suppliers",
    title:        "Close a conversation",
    oneLiner:     "Revoke a trade's reply link if you're done — they can still WhatsApp you, but they can't post into your SiteBook.",
    previewSvg:   svgWireframe({ x: 10, y: 100, w: 62, h: 10, label: "archive" }),
    clickPath:    ["Left panel footer", "View archived", "Close conversation"],
    deepBody:     "Every conversation has a kill-switch. Revoke the reply link and the trade's next tap on nw.app/r/… shows a friendly 'this conversation was closed' page. They still have your WhatsApp number (that's real-world), but they can't drop anything into your SiteBook feed. Closed threads still show under the Archived tab for reference — nothing is destroyed.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='view-archived']", title: "View archived", body: "Jump to the threads settings page to close (or restore) any conversation.", side: "top" }
    ]
  },

  // ── CENTER — Feed + Composer ───────────────────────────────────────
  {
    id:           "post-update",
    section:      "composer",
    sectionLabel: "Center · Composer",
    title:        "Post an update",
    oneLiner:     "Write once, pick who sees it. Update / Question / New work / Warranty — pick a kind.",
    previewSvg:   svgWireframe({ x: 84, y: 32, w: 82, h: 22, label: "composer" }),
    clickPath:    ["Composer", "Pick kind", "Write body", "Post"],
    deepBody:     "Every post has a 'kind' that shapes how trades see it. Update = general project progress. Question = you need an answer. New work = new job on the project. Warranty = a work item to log for the vault. The kind drives the visual tone (colour + icon) and downstream analytics (how often you post questions vs updates).",
    live:         true,
    tourSteps: [
      { element: "[data-tour='composer']", title: "Composer", body: "Pick kind → write → post. Trades see the post in their inbox instantly.", side: "top" }
    ]
  },
  {
    id:           "invite-specific",
    section:      "composer",
    sectionLabel: "Center · Composer",
    title:        "Invite specific trades to a post",
    oneLiner:     "By default only invited trades see the post. 'All trades' broadcasts to everyone on the project.",
    previewSvg:   svgWireframe({ x: 84, y: 60, w: 82, h: 14, label: "invite" }),
    clickPath:    ["Composer", "Visibility toggle", "Pick trades"],
    deepBody:     "Each post is a scoped Slack-style channel. Visibility = 'selected' means only trades you tick see it — perfect for a private update to the plumber without the tiler seeing it. Visibility = 'all trades' broadcasts to every hired trade on that project — useful for warranty completions or project-wide announcements.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='composer']", title: "Pick who sees it", body: "Tick the trades who should see this post. Non-invited trades don't see it at all.", side: "top" }
    ]
  },
  {
    id:           "thread-replies",
    section:      "feed",
    sectionLabel: "Center · Feed",
    title:        "All replies chronologically",
    oneLiner:     "Every reply — from any trade or via WhatsApp — lands under the post that started the thread.",
    previewSvg:   svgWireframe({ x: 84, y: 82, w: 82, h: 30, label: "thread" }),
    clickPath:    ["Feed", "Post card", "Scroll to replies"],
    deepBody:     "The post is the channel. Replies from trades (via the inline reply field OR via the WhatsApp reply-link) both mirror onto the same post card. Chronological, one truth. When you re-open a post weeks later, the full conversation is there — no jumping between apps.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='post-card']", title: "One post, all replies", body: "Reply here or via WhatsApp — both land in the same thread on this card.", side: "top" }
    ]
  },
  {
    id:           "add-photos",
    section:      "feed",
    sectionLabel: "Center · Feed",
    title:        "Add photos to a post",
    oneLiner:     "Upload before / in-progress / after photos. Trades upload directly from the job.",
    previewSvg:   svgWireframe({ x: 84, y: 88, w: 82, h: 20, label: "photos" }),
    clickPath:    ["Post card", "Add photo", "Upload"],
    deepBody:     "Every photo attaches to a specific post (not just the project) so context stays crisp. Trades can upload from their phone at the job — a builder mid-installation can drop a photo straight into the same post you started. Full-resolution originals preserved; the SiteBook renders web-optimised versions for speed.",
    live:         false,
    tourSteps:    []
  },

  // ── RIGHT — Reveals + Profile ──────────────────────────────────────
  {
    id:           "reveals-pricing",
    section:      "profile",
    sectionLabel: "Right panel · Reveals",
    title:        "How reveals + pricing work",
    oneLiner:     "3 free WhatsApp reveals per month. Bigger packs price at ~£1 per contact.",
    previewSvg:   svgWireframe({ x: 180, y: 40, w: 48, h: 16, label: "credits" }),
    clickPath:    ["Right panel", "Reveal usage card", "Top up"],
    deepBody:     "A 'reveal' = one unique (post, trade) WhatsApp conversation. Every follow-up message on the same thread is FREE — you only spend a credit the first time you reveal a trade's WhatsApp on a new topic. Free tier gets 3 reveals/month, Pro gets 30, and pack purchases (5/10/20/50/100) top up any tier. The £1 net-per-contact model means honest pricing after Stripe + VAT.",
    live:         true,
    tourSteps: [
      { element: "[data-tour='reveal-usage']", title: "Your reveal balance", body: "Monthly credits reset on the 1st. Pack credits are permanent.", side: "left" }
    ]
  },
  {
    id:           "go-pro",
    section:      "profile",
    sectionLabel: "Right panel · Reveals",
    title:        "Go Pro — £4.99 / month",
    oneLiner:     "30 reveals + unlimited storage + priority beacon matching.",
    previewSvg:   svgWireframe({ x: 180, y: 60, w: 48, h: 12, label: "Pro" }),
    clickPath:    ["Right panel", "Go Pro CTA"],
    deepBody:     "Pro tier makes sense when you're running multiple projects at once and hitting the 3-reveal monthly ceiling. 30 reveals covers the busiest homeowner in a normal month. Unlimited storage means the photos + PDFs never get gated. Priority beacon matching pushes your project brief to matching trades first.",
    live:         false,
    tourSteps:    []
  },
  {
    id:           "warranty-vault",
    section:      "profile",
    sectionLabel: "Right panel · Vault",
    title:        "Warranty vault + expiry reminders",
    oneLiner:     "Every warranty auto-logged. Auto-ping 30 days before expiry.",
    previewSvg:   svgWireframe({ x: 180, y: 78, w: 48, h: 16, label: "warranty" }),
    clickPath:    ["Right panel", "Vault", "Add warranty (or auto-log)"],
    deepBody:     "When a job completes on any project, the warranty is captured with expiry date, work description, trade + invoice link. 30 days before expiry we auto-email you AND ping you in the SiteBook feed as a system post — so you don't lose a claim window. When you sell the house, every active warranty transfers via the £9.99 export.",
    live:         false,
    tourSteps:    []
  },
  {
    id:           "export",
    section:      "profile",
    sectionLabel: "Right panel · Export",
    title:        "Export your SiteBook — £9.99",
    oneLiner:     "Every post, photo, warranty and invoice in one PDF + ZIP. Transfers with the house.",
    previewSvg:   svgWireframe({ x: 180, y: 98, w: 48, h: 12, label: "export" }),
    clickPath:    ["Right panel", "Export options"],
    deepBody:     "One-off £9.99. You get a beautifully formatted PDF (project-by-project) plus a ZIP of every original-resolution photo and every invoice or document you've attached. When you sell, the buyer gets a real record of every job done on the house — service history, warranties, trade contacts. Adds real value at completion; homeowners commonly report it saves days of solicitor back-and-forth.",
    live:         false,
    tourSteps:    []
  }
];

// ─── Convenience selectors ──────────────────────────────────────────

export function findFeatureById(id: string): GuideFeature | null {
  return HOW_IT_WORKS_FEATURES.find((f) => f.id === id) ?? null;
}

export function featuresBySection(section: GuideSection): GuideFeature[] {
  return HOW_IT_WORKS_FEATURES.filter((f) => f.section === section);
}

export const GUIDE_SECTIONS: Array<{ id: GuideSection; label: string; icon: string }> = [
  { id: "inbox",    label: "Trades & Suppliers",  icon: "MessageCircle" },
  { id: "composer", label: "Composer",            icon: "Edit3" },
  { id: "feed",     label: "Feed",                icon: "List" },
  { id: "profile",  label: "Reveals + Profile",   icon: "User" },
  { id: "trades",   label: "Your team",           icon: "Users" }
];
