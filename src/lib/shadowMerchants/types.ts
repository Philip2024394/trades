// Shadow-profile scraper — shared types.
//
// See docs: this system pre-scrapes UK trade businesses from public
// sources, generates unpublished shadow profiles, and drips a 6-touch
// email sequence to convert merchants into claimed accounts.
//
// Legal: PECR B2B + UK GDPR public-data. See migration
// 20260718090000_hammerex_shadow_merchants.sql for schema.

export type ShadowMerchantStatus =
  | "scraped"     // just pulled from a source, no profile generated yet
  | "queued"      // shadow profile built, slug reserved, ready for drip
  | "sending"     // in active drip sequence
  | "claimed"     // merchant clicked claim link + verified — flipped to live
  | "suppressed"  // unsubscribed / bounced / complained
  | "released";   // sequence exhausted, slug returned to pool

export type ShadowMerchantSource =
  | "companies_house"
  | "google_places"
  | "yell"
  | "cylex"
  | "manual";

export type EmailEventType =
  | "queued"       // sender picked it up, about to send
  | "sent"         // Postmark accepted for delivery
  | "delivered"    // Postmark webhook — inbox accepted
  | "open"         // pixel fired
  | "click"        // link clicked
  | "reply"        // reply detected via inbound parse
  | "bounce"       // hard or soft bounce
  | "complaint"    // spam complaint
  | "unsubscribe"; // clicked unsubscribe link

export type SuppressionReason =
  | "unsubscribe"
  | "bounce"
  | "complaint"
  | "admin";

export type ShadowMerchant = {
  id:                     string;
  source:                 ShadowMerchantSource;
  source_ref:             string | null;
  scraped_at:             string;
  business_name:          string;
  trade_type:             string | null;
  trade_type_raw:         string | null;
  city:                   string | null;
  postcode:               string | null;
  address_line:           string | null;
  phone:                  string | null;
  email:                  string | null;
  website:                string | null;
  companies_house_number: string | null;
  gbp_place_id:           string | null;
  gbp_star_rating:        number | null;
  gbp_review_count:       number | null;
  years_established:      number | null;
  reserved_slug:          string;
  status:                 ShadowMerchantStatus;
  claim_token:            string | null;
  claimed_at:             string | null;
  claimed_listing_id:     string | null;
  released_at:            string | null;
  next_step_index:        number;
  next_step_due_at:       string | null;
  last_step_sent_at:      string | null;
  // Enrichment tracking — populated by /api/cron/shadow-profile-enrich
  enriched_at:            string | null;
  enrichment_attempts:    number;
  enrichment_source:      string | null;
  created_at:             string;
  updated_at:             string;
};

// Payload we hand to email templates. Populated by the personalizer.
export type EmailContext = {
  merchant:            ShadowMerchant;
  firstName:           string;            // best-effort first name (may be business owner or fallback)
  greetingName:        string;            // "Joe" or "Joe's Plumbing" or "there" — safe for opener
  cityLabel:           string;            // "Manchester" or "your area"
  tradeLabel:          string;            // "plumbing" or "your trade"
  reservedUrl:         string;            // https://thenetworkers.app/joes-plumbing
  claimUrl:            string;            // https://thenetworkers.app/claim/{token}
  unsubscribeUrl:      string;            // https://thenetworkers.app/claim/{token}/unsubscribe
  senderName:          string;            // "Philip"
  senderEmail:         string;            // "philip@thenetworkers.app"
  senderPhone:         string;            // "+44 xxx xxx xxxx"
  // Optional context filled by the personalizer where available
  recentBeaconCount:   number | null;     // "3 leads posted in Manchester this week"
  nearbyClaimedName:   string | null;     // for the "your competitor just claimed" step
  nearbyClaimedSlug:   string | null;
};

// Email template shape — every step exports one of these.
export type EmailTemplate = {
  stepIndex:     number;                  // 0..5
  slug:          string;                  // 'day0-reserved' etc — used in the events log
  delayFromPrevMs: number;                // ms from the previous step's send time (0 for step 0)
  subject:       (ctx: EmailContext) => string;
  body:          (ctx: EmailContext) => string;   // plain-text, no HTML chrome
};

// Postmark send request (minimal — we don't use HTML/tags/etc)
export type PostmarkSendRequest = {
  From:          string;
  To:            string;
  Subject:       string;
  TextBody:      string;
  ReplyTo:       string;
  MessageStream: string;                  // "outbound" for transactional / dedicated for broadcast
  Headers?:      Array<{ Name: string; Value: string }>;
  Metadata?:     Record<string, string>;
};

export type PostmarkSendResponse = {
  MessageID:      string;
  SubmittedAt:    string;
  To:             string;
  ErrorCode:      number;
  Message:        string;
};
