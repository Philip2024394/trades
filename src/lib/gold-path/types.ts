// Gold Path tasks — the weekly operating guide backing data.

export type GoldPathUrgency = "low" | "normal" | "high" | "urgent";
export type GoldPathStatus =
  | "open"
  | "in_progress"
  | "done"
  | "dismissed"
  | "expired";

export type GoldPathTaskKind =
  | "reply_to_review"
  | "complete_story_arc"
  | "record_work"
  | "chase_consent"
  | "reconnect_channel"
  | "reply_lead"
  | "share_certification"
  | "post_gap_reminder";

export type GoldPathTask = {
  id: string;
  merchantId: string;
  taskKind: GoldPathTaskKind;
  title: string;
  bodyMarkdown: string | null;
  ctaKind: string | null;
  ctaTarget: string | null;
  urgency: GoldPathUrgency;
  sourceEventId: string | null;
  sourceProjectionType: string | null;
  status: GoldPathStatus;
  opensAt: string;
  expiresAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};
