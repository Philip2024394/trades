// Nex Social — types.

export const SOCIAL_PLATFORMS = [
  "facebook", "instagram", "tiktok", "linkedin", "google_business", "whatsapp_business"
] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export const POST_STATES = [
  "draft", "awaiting_approval", "approved", "scheduled", "publishing", "published", "failed", "rejected"
] as const;
export type PostState = typeof POST_STATES[number];

/** Transitions the state machine allows. Enforced by transitionPost(). */
export const ALLOWED_TRANSITIONS: Record<PostState, PostState[]> = {
  draft:               ["awaiting_approval", "rejected"],
  awaiting_approval:   ["approved", "rejected", "draft"],
  approved:            ["scheduled", "publishing", "rejected"],
  scheduled:           ["publishing", "rejected", "approved"],
  publishing:          ["published", "failed"],
  published:           [],
  failed:              ["approved", "rejected"],
  rejected:            []
};

export type SocialAccount = {
  id:                  string;
  merchant_slug:       string;
  platform:            SocialPlatform;
  display_name:        string | null;
  platform_account_id: string | null;
  scopes:              string[];
  status:              "connected" | "revoked" | "expired" | "error" | "pending";
  connected_at:        string;
  last_success_at:     string | null;
  last_error:          string | null;
  token_expires_at:    string | null;
  created_at:          string;
  updated_at:          string;
};

export type SocialPostImage = {
  url:    string;
  alt:    string;
  source: "brand" | "project" | "upload" | "template";
};

export type SocialPost = {
  id:                string;
  merchant_slug:     string;
  campaign_id:       string | null;
  platform:          SocialPlatform;
  status:            PostState;
  headline:          string | null;
  caption:           string;
  hashtags:          string[];
  call_to_action:    string | null;
  image_urls:        SocialPostImage[];
  project_ref:       string | null;
  brand_snapshot_id: string | null;
  created_by:        string;
  approved_by:       string | null;
  approved_at:       string | null;
  rejected_reason:   string | null;
  scheduled_for:     string | null;
  scheduled_tz:      string | null;
  published_at:      string | null;
  platform_post_id:  string | null;
  platform_post_url: string | null;
  publish_error:     string | null;
  publish_attempts:  number;
  created_at:        string;
  updated_at:        string;
};

export type SocialCampaign = {
  id:              string;
  merchant_slug:   string;
  name:            string;
  theme:           string | null;
  trade_focus:     string | null;
  goal:            string | null;
  target_audience: string | null;
  status:          "active" | "paused" | "ended";
  starts_at:       string | null;
  ends_at:         string | null;
  created_at:      string;
  updated_at:      string;
};

export type SocialSchedule = {
  id:            string;
  merchant_slug: string;
  campaign_id:   string | null;
  platform:      SocialPlatform;
  pattern:       string;               // 'weekly:friday@17:00'
  timezone:      string;               // IANA
  status:        "active" | "paused" | "ended";
  next_run_at:   string | null;
  last_run_at:   string | null;
  created_at:    string;
};

/** Per-platform copy constraints. Kept small; grow as we hit platform quirks. */
export const PLATFORM_LIMITS: Record<SocialPlatform, {
  captionMax:  number;
  hashtagsMax: number;
  imagesMax:   number;
  imageAspect?: string;
}> = {
  facebook:          { captionMax: 63206, hashtagsMax: 30, imagesMax: 10 },
  instagram:         { captionMax: 2200,  hashtagsMax: 30, imagesMax: 10, imageAspect: "1:1 or 4:5" },
  tiktok:            { captionMax: 2200,  hashtagsMax: 20, imagesMax: 35 },
  linkedin:          { captionMax: 3000,  hashtagsMax: 5,  imagesMax: 9  },
  google_business:   { captionMax: 1500,  hashtagsMax: 0,  imagesMax: 10 },
  whatsapp_business: { captionMax: 1024,  hashtagsMax: 0,  imagesMax: 1  }
};
