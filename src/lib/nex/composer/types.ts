// NEX Composer · block model + template + quality-check types
//
// A composed email is an ORDERED ARRAY OF BLOCKS. The renderer turns
// blocks into (a) email-safe HTML with table layout + inline styles ·
// (b) a plain-text alternative.
//
// Layer separation (Philip 2026-08-07):
//   Composer         creates content
//   Campaign Builder manages campaigns
//   Audience Engine  selects recipients
//   Email Runtime    delivers messages

export type BlockAlign = "left" | "center" | "right";

// ── 14 block types (spec Philip 2026-08-07) ────────────────────────
export type Block =
  | { id: string; type: "heading";       text: string; level: 1 | 2 | 3; align?: BlockAlign }
  | { id: string; type: "paragraph";     text: string; align?: BlockAlign }
  | { id: string; type: "image";         src: string; alt: string; width_pct?: number; align?: BlockAlign; href?: string }
  | { id: string; type: "button";        text: string; href: string; align?: BlockAlign; color?: string; bg?: string }
  | { id: string; type: "divider";       color?: string }
  | { id: string; type: "spacer";        height: number }
  | { id: string; type: "columns";       columns: Block[][] }                        // 2-3 columns; each is a nested block list
  | { id: string; type: "hero";          src?: string; heading: string; subheading?: string; cta_text?: string; cta_href?: string; bg?: string }
  | { id: string; type: "feature_grid";  features: Array<{ icon?: string; title: string; body: string }> }
  | { id: string; type: "cta";           heading: string; body?: string; cta_text: string; cta_href: string; align?: BlockAlign; bg?: string }
  | { id: string; type: "gallery";       items: Array<{ src: string; alt: string; href?: string }> }
  | { id: string; type: "signature";     name: string; role?: string; company?: string; email?: string; phone?: string; photo_src?: string }
  | { id: string; type: "footer";        company: string; address?: string; unsubscribe_text?: string }
  | { id: string; type: "social_links";  links: Array<{ platform: "twitter" | "linkedin" | "instagram" | "facebook" | "youtube" | "website"; href: string; label?: string }> };

export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading:      "Heading",
  paragraph:    "Paragraph",
  image:        "Image",
  button:       "Button",
  divider:      "Divider",
  spacer:       "Spacer",
  columns:      "Columns",
  hero:         "Hero Banner",
  feature_grid: "Feature Grid",
  cta:          "Call to Action",
  gallery:      "Gallery",
  signature:    "Signature",
  footer:       "Footer",
  social_links: "Social Links",
};

// ── Variables (spec Philip 2026-08-07 · 7 built-ins) ──────────────
export type VariableName =
  | "name" | "company" | "trade" | "country" | "email" | "unsubscribe_link" | "current_year";

export type VariableDef = {
  name: VariableName;
  description: string;
  sample_value: string;
  source: "contact_registry" | "runtime" | "email_runtime";
};

export const VARIABLES: VariableDef[] = [
  { name: "name",             description: "Contact display name",         sample_value: "Alex",                                     source: "contact_registry" },
  { name: "company",          description: "Contact company",              sample_value: "Oak Stairs Ltd",                           source: "contact_registry" },
  { name: "trade",            description: "Primary trade category",       sample_value: "staircase",                                source: "contact_registry" },
  { name: "country",          description: "ISO country / label",          sample_value: "GB",                                       source: "contact_registry" },
  { name: "email",            description: "Canonical email",              sample_value: "alex@example.com",                          source: "contact_registry" },
  { name: "unsubscribe_link", description: "One-click unsubscribe URL",    sample_value: "https://thenetworkers.app/u/abc123",       source: "email_runtime" },
  { name: "current_year",     description: "Current calendar year",        sample_value: String(new Date().getFullYear()),           source: "runtime" },
];

export type VariableContext = Partial<Record<VariableName, string>>;

// ── Template ───────────────────────────────────────────────────────
export type TemplateCategory =
  | "announcement" | "newsletter" | "feature_release" | "welcome"
  | "quote_followup" | "reminder" | "event" | "seasonal" | "other";

export type EmailTemplate = {
  template_id: string;
  name: string;
  category: TemplateCategory;
  description: string | null;
  subject: string | null;
  preview_text: string | null;
  blocks: Block[];
  is_seed: boolean;
  is_draft: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  used_count: number;
  last_used_at: string | null;
};

export type TemplateInput = {
  name: string;
  category?: TemplateCategory;
  description?: string | null;
  subject?: string | null;
  preview_text?: string | null;
  blocks: Block[];
  is_draft?: boolean;
  created_by?: string | null;
};

// ── Quality checks (spec Philip 2026-08-07 · 7 categories) ────────
export type QualitySeverity = "error" | "warning" | "info";

export type QualityCheck = {
  id: string;
  severity: QualitySeverity;
  category:
    | "missing_subject" | "missing_unsubscribe" | "broken_variables"
    | "missing_images"  | "missing_buttons"     | "accessibility"
    | "spam_risk";
  message: string;
  detail?: string;
};
