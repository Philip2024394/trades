export type SignalType =
  | "like"
  | "comment"
  | "save"
  | "share"
  | "click_through"
  | "view"
  | "lead_form_submit"
  | "call"
  | "whatsapp_tap"
  | "booking";

export type Signal = {
  id: string;
  merchantId: string;
  publicationId: string | null;
  eventId: string | null;
  signalType: SignalType;
  observedAt: string;
  value: number | null;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
