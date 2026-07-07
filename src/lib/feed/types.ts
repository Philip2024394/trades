// Feed post types — the merchant's live website timeline.

export type FeedPostStatus =
  | "scheduled" // in the 60-min approval buffer
  | "published" // live on the merchant's public site
  | "held" // merchant hit "Hold" — indefinite
  | "archived" // merchant removed it from public view
  | "failed"; // projection couldn't compose a post

export type FeedCtaKind =
  | "get_quote"
  | "call"
  | "book"
  | "message"
  | null;

export type FeedPost = {
  id: string;
  merchantId: string;
  slug: string;
  headline: string;
  bodyMarkdown: string;
  heroImageUrl: string | null;
  photoUrls: string[];
  facets: Record<string, unknown>;
  ctaKind: FeedCtaKind;
  ctaTarget: string | null;
  linkedEventId: string | null;
  linkedMemoryRecordId: string | null;
  status: FeedPostStatus;
  holdReason: string | null;
  scheduledFor: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedFacets = {
  trade?: string;
  service?: string;
  materials?: string[];
  colours?: string[];
  postcode?: string;
  city?: string;
  cost_band?: string;
  stage?: string;
};
