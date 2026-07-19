// SiteBook — shared types for the homeowner side of the platform.
//
// Mirrors merchant-side patterns (hammerex_trade_off_listings) but
// homeowner-owned. Every project belongs to one homeowner + can have
// multiple trades as members (like a shared Google Doc).

export type PremiumTier = "free" | "premium";

export type ProjectStatus =
  | "draft"        // homeowner started but hasn't published yet
  | "active"       // published, trades can be invited / beacon-posted
  | "in-progress"  // trades hired, work happening
  | "complete"     // work done, warranties logged
  | "archived";    // put away, still viewable

export type ProjectTimeline =
  | "urgent"
  | "1-4-weeks"
  | "1-3-months"
  | "3-plus-months"
  | "flexible";

export type MemberRole    = "lead" | "sub" | "consultant";
export type MemberStatus  =
  | "invited"       // trade received invite, hasn't opened
  | "accepted"      // trade opened the invite
  | "quoting"       // trade is preparing/added quote
  | "hired"         // homeowner picked them
  | "in-progress"   // actively working
  | "complete"      // finished
  | "declined";     // trade said no

export type MessageAuthorType = "homeowner" | "trade" | "system";
export type MessageAttachment  = "photo" | "document" | "quote" | "invoice";
export type MessageVisibility  = "all" | "homeowner-only" | "trades-only";
export type PhotoStage         = "before" | "in-progress" | "after";

// Post-centric SiteBook (2026-07-18) — Slack-channels-per-topic
// architecture. Each post is a scoped channel with its own invited
// trades. See migration 20260718140000_hammerex_sitebook_posts.sql.

export type PostKind =
  | "update"
  | "new-work"
  | "question"
  | "warranty"
  | "completion"
  | "trade-note";

export type PostVisibility = "selected" | "all-trades";
export type PostStatus     = "open" | "closed" | "archived";
export type PostAuthorType = "homeowner" | "trade" | "system";
export type PostMemberRole = "primary" | "copied-in" | "observer";

export type SiteBookPost = {
  id:                   string;
  project_id:           string;
  homeowner_id:         string;
  title:                string | null;
  body:                 string;
  cover_photo_url:      string | null;
  kind:                 PostKind;
  visibility:           PostVisibility;
  author_type:          PostAuthorType;
  author_listing_id:    string | null;
  author_display_name:  string;
  reply_count:          number;
  last_reply_at:        string | null;
  pinned:               boolean;
  status:               PostStatus;
  created_at:           string;
  updated_at:           string;
};

export type SiteBookPostMember = {
  id:            string;
  post_id:       string;
  listing_id:    string;
  merchant_slug: string | null;
  merchant_name: string | null;
  role:          PostMemberRole;
  last_read_at:  string | null;
  invited_at:    string;
};

export type SiteBookPostReply = {
  id:              string;
  post_id:         string;
  author_type:     PostAuthorType;
  author_id:       string | null;
  author_name:     string;
  body:            string;
  attachment_url:  string | null;
  attachment_kind: MessageAttachment | null;
  created_at:      string;
};

export type EventType =
  | "project_created"
  | "project_published"
  | "trade_invited"
  | "trade_accepted"
  | "trade_declined"
  | "trade_quoted"
  | "trade_hired"
  | "project_started"
  | "project_completed"
  | "photo_added"
  | "message_posted"
  | "warranty_added"
  | "invoice_added";

export type Homeowner = {
  id:                 string;
  email:              string;
  password_hash:      string | null;
  whatsapp_number:    string | null;
  first_name:         string | null;
  last_name:          string | null;
  city:               string | null;
  postcode:           string | null;
  house_nickname:     string;                 // required — becomes the URL slug
  slug:               string;                 // required — thenetworkers.app/{slug} (root level)
  premium_tier:       PremiumTier;
  premium_since:      string | null;
  created_at:         string;
  updated_at:         string;
};

export type SiteBookProject = {
  id:                 string;
  homeowner_id:       string;
  title:              string;
  description:        string | null;
  trade_types:        string[];
  address_postcode:   string | null;
  address_city:       string | null;
  address_line:       string | null;
  budget_min_gbp:     number | null;
  budget_max_gbp:     number | null;
  timeline:           ProjectTimeline | null;
  status:             ProjectStatus;
  cover_photo_url:    string | null;
  posted_to_beacon:   boolean;
  beacon_posted_at:   string | null;
  started_at:         string | null;
  completed_at:       string | null;
  total_spent_gbp:    number;
  created_at:         string;
  updated_at:         string;
};

export type SiteBookMember = {
  id:                 string;
  project_id:         string;
  listing_id:         string;
  merchant_slug:      string;
  merchant_name:      string;
  trade_type:         string | null;
  member_role:        MemberRole;
  status:             MemberStatus;
  quote_amount_gbp:   number | null;
  quote_notes:        string | null;
  quote_at:           string | null;
  invited_at:         string;
  accepted_at:        string | null;
  hired_at:           string | null;
  completed_at:       string | null;
  declined_at:        string | null;
};

export type SiteBookMessage = {
  id:                 string;
  project_id:         string;
  author_type:        MessageAuthorType;
  author_id:          string | null;
  author_name:        string;
  body:               string;
  attachment_url:     string | null;
  attachment_kind:    MessageAttachment | null;
  visibility:         MessageVisibility;
  created_at:         string;
};

export type SiteBookPhoto = {
  id:                 string;
  project_id:         string;
  uploaded_by_type:   "homeowner" | "trade";
  uploaded_by_id:     string | null;
  uploaded_by_name:   string | null;
  storage_url:        string;
  caption:            string | null;
  stage:              PhotoStage | null;
  created_at:         string;
};

export type SiteBookWarranty = {
  id:                 string;
  project_id:         string;
  trade_listing_id:   string;
  trade_name:         string;
  work_description:   string;
  work_completed_at:  string;
  warranty_years:     number;
  warranty_expires_at: string;
  invoice_url:        string | null;
  invoice_amount_gbp: number | null;
  notes:              string | null;
  reminder_sent_at:   string | null;
  created_at:         string;
};

export const TRADE_TYPE_OPTIONS = [
  { slug: "plumber",           label: "Plumber" },
  { slug: "electrician",       label: "Electrician" },
  { slug: "roofer",            label: "Roofer" },
  { slug: "carpenter",         label: "Carpenter" },
  { slug: "joiner",            label: "Joiner" },
  { slug: "bricklayer",        label: "Bricklayer" },
  { slug: "tiler",             label: "Tiler" },
  { slug: "plasterer",         label: "Plasterer" },
  { slug: "painter",           label: "Painter/Decorator" },
  { slug: "landscaper",        label: "Landscaper" },
  { slug: "builder",           label: "Builder" },
  { slug: "gas-engineer",      label: "Gas Engineer" },
  { slug: "heating-engineer",  label: "Heating Engineer" },
  { slug: "scaffolder",        label: "Scaffolder" },
  { slug: "glazier",           label: "Glazier" },
  { slug: "drywaller",         label: "Drywaller" },
  { slug: "kitchen-fitter",    label: "Kitchen Fitter" },
  { slug: "bathroom-fitter",   label: "Bathroom Fitter" }
] as const;

export const TIMELINE_OPTIONS: Array<{ value: ProjectTimeline; label: string }> = [
  { value: "urgent",         label: "Urgent — this week" },
  { value: "1-4-weeks",      label: "1-4 weeks" },
  { value: "1-3-months",     label: "1-3 months" },
  { value: "3-plus-months",  label: "3+ months" },
  { value: "flexible",       label: "Flexible / no rush" }
];
