// NEX Composer · 8 seed templates (spec Philip 2026-08-07)
//
// These ship with NEX (is_seed = TRUE · protected from deletion) and
// are inserted on first launch by ensureSeedTemplates(). Users can
// duplicate + edit but not archive.

import type { Block, EmailTemplate, TemplateCategory } from "./types";

type Seed = { name: string; category: TemplateCategory; description: string; subject: string; preview_text: string; blocks: Block[] };

let n = 0;
const id = (prefix: string) => `${prefix}_${++n}`;

export const SEED_TEMPLATES: Seed[] = [
  {
    name: "Product Announcement",
    category: "announcement",
    description: "Introduce a new product to your list",
    subject: "Introducing {{company}}'s newest product",
    preview_text: "Something you asked for is here.",
    blocks: [
      { id: id("hero"),       type: "hero", heading: "Something new from {{company}}", subheading: "Built for {{trade}} teams in {{country}}", cta_text: "See it", cta_href: "https://example.com/new", bg: "#0f172a" },
      { id: id("p"),          type: "paragraph", text: "Hi {{name}}, we shipped something we think you'll love." },
      { id: id("feat"),       type: "feature_grid", features: [
        { icon: "⚡", title: "Fast",    body: "Half the taps to complete a job" },
        { icon: "🎯", title: "Focused", body: "Built for your specific trade" },
        { icon: "🔒", title: "Yours",   body: "Your data · your control" },
      ]},
      { id: id("cta"),        type: "cta", heading: "Try it today", cta_text: "Open", cta_href: "https://example.com/open" },
      { id: id("foot"),       type: "footer", company: "{{company}}" },
    ],
  },
  {
    name: "Newsletter",
    category: "newsletter",
    description: "Weekly digest of stories + updates",
    subject: "This week in {{trade}} — {{current_year}}",
    preview_text: "Five things worth knowing this week.",
    blocks: [
      { id: id("h"),  type: "heading", text: "This week", level: 1 },
      { id: id("p"),  type: "paragraph", text: "Hi {{name}}, here's what we noticed this week in the {{trade}} world." },
      { id: id("d"),  type: "divider" },
      { id: id("h2"), type: "heading", text: "1 · Story", level: 2 },
      { id: id("p2"), type: "paragraph", text: "Short paragraph about the first story." },
      { id: id("h3"), type: "heading", text: "2 · Story", level: 2 },
      { id: id("p3"), type: "paragraph", text: "Short paragraph about the second story." },
      { id: id("h4"), type: "heading", text: "3 · Story", level: 2 },
      { id: id("p4"), type: "paragraph", text: "Short paragraph about the third story." },
      { id: id("btn"), type: "button", text: "Read more →", href: "https://example.com/newsletter", align: "center" },
      { id: id("foot"), type: "footer", company: "NEX" },
    ],
  },
  {
    name: "New Feature Release",
    category: "feature_release",
    description: "Detailed walkthrough of a new capability",
    subject: "New in {{company}}: feature that saves you time",
    preview_text: "See how it works in 2 minutes.",
    blocks: [
      { id: id("h"), type: "heading", text: "We built the thing you asked for", level: 1 },
      { id: id("p"), type: "paragraph", text: "Hi {{name}}, following feedback from {{trade}} teams in {{country}}, we shipped a new capability today." },
      { id: id("img"), type: "image", src: "", alt: "Screenshot placeholder", width_pct: 100 },
      { id: id("h2"), type: "heading", text: "What's changed", level: 2 },
      { id: id("p2"), type: "paragraph", text: "Explain the change here." },
      { id: id("cta"), type: "cta", heading: "Try it now", cta_text: "Open feature", cta_href: "https://example.com/feature" },
      { id: id("sig"), type: "signature", name: "The {{company}} team", role: "" },
      { id: id("foot"), type: "footer", company: "{{company}}" },
    ],
  },
  {
    name: "Welcome",
    category: "welcome",
    description: "First message to new sign-ups",
    subject: "Welcome to {{company}}, {{name}}",
    preview_text: "Here's what to do first.",
    blocks: [
      { id: id("h"), type: "heading", text: "Welcome to {{company}}", level: 1 },
      { id: id("p"), type: "paragraph", text: "Hi {{name}}, thanks for joining. Here's what to do first:" },
      { id: id("p2"), type: "paragraph", text: "1. Complete your profile\n2. Import your contacts\n3. Send your first message" },
      { id: id("cta"), type: "cta", heading: "Get started", cta_text: "Open your workspace", cta_href: "https://example.com/start" },
      { id: id("foot"), type: "footer", company: "{{company}}" },
    ],
  },
  {
    name: "Quote Follow-up",
    category: "quote_followup",
    description: "Nudge on a pending quote",
    subject: "Following up on your quote",
    preview_text: "Still thinking it over? Happy to help.",
    blocks: [
      { id: id("p"),  type: "paragraph", text: "Hi {{name}}, following up on the quote we sent last week." },
      { id: id("p2"), type: "paragraph", text: "If you have any questions or want to talk something through, just reply to this email." },
      { id: id("btn"), type: "button", text: "View quote", href: "https://example.com/quote" },
      { id: id("sig"), type: "signature", name: "{{company}} team" },
    ],
  },
  {
    name: "Reminder",
    category: "reminder",
    description: "Gentle nudge for an action or deadline",
    subject: "Quick reminder · {{name}}",
    preview_text: "One thing to finish up.",
    blocks: [
      { id: id("h"), type: "heading", text: "Quick reminder", level: 2 },
      { id: id("p"), type: "paragraph", text: "Hi {{name}}, this is a friendly reminder that we're expecting one more thing from you." },
      { id: id("btn"), type: "button", text: "Complete now", href: "https://example.com/action", align: "center" },
    ],
  },
  {
    name: "Event Invitation",
    category: "event",
    description: "Invite recipients to an event",
    subject: "You're invited: {{company}} event",
    preview_text: "Save the date.",
    blocks: [
      { id: id("hero"), type: "hero", heading: "You're invited", subheading: "Join us for a {{trade}} community meetup", cta_text: "RSVP", cta_href: "https://example.com/rsvp", bg: "#1e40af" },
      { id: id("p"), type: "paragraph", text: "Hi {{name}}, we're hosting an event and would love for you to come." },
      { id: id("p2"), type: "paragraph", text: "Location · Date · Time" },
      { id: id("cta"), type: "cta", heading: "Save your spot", cta_text: "RSVP now", cta_href: "https://example.com/rsvp" },
      { id: id("foot"), type: "footer", company: "{{company}}" },
    ],
  },
  {
    name: "Seasonal Promotion",
    category: "seasonal",
    description: "Time-bound offer for a season/holiday",
    subject: "A little something from {{company}}",
    preview_text: "For a limited time.",
    blocks: [
      { id: id("hero"), type: "hero", heading: "A season of savings", subheading: "For our {{trade}} customers in {{country}}", cta_text: "Shop now", cta_href: "https://example.com/shop", bg: "#166534" },
      { id: id("p"), type: "paragraph", text: "Hi {{name}}, we're running a limited-time promotion just for you." },
      { id: id("btn"), type: "button", text: "See the offer", href: "https://example.com/offer", align: "center", bg: "#166534" },
      { id: id("foot"), type: "footer", company: "{{company}}" },
    ],
  },
];

/** Reset the id counter — used only for tests. */
export function _resetSeedIds() { n = 0; }

export type SeedTemplate = Seed;

export function isSeedName(name: string): boolean {
  return SEED_TEMPLATES.some((s) => s.name === name);
}

// Used by /api/nex/composer/templates for filtering + returning seeds
// even when DB has no rows yet.
export function seedAsTemplates(): EmailTemplate[] {
  const now = new Date().toISOString();
  return SEED_TEMPLATES.map((s, i) => ({
    template_id: `seed-${i + 1}`,
    name: s.name,
    category: s.category,
    description: s.description,
    subject: s.subject,
    preview_text: s.preview_text,
    blocks: s.blocks,
    is_seed: true,
    is_draft: false,
    created_by: "nex-seed",
    created_at: now,
    updated_at: now,
    used_count: 0,
    last_used_at: null,
  }));
}
