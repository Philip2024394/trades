// Messaging data model (R-Messaging, MVP week 1).
//
// Trade Center native messaging — the primary channel between trades
// and merchants. Every thread carries context (product, merchant, job,
// order) so replies stay attached to what they're about. Constitution
// Rule #6: Trade Center hosts the record; we do not police or scrape
// off-platform conversations. If a merchant + trade also chat on
// WhatsApp we log that the deep-link was opened but never see the
// conversation itself.

export type Participant = {
  /** Slug of the trade / merchant / support account. */
  slug: string;
  /** Display name. */
  name: string;
  /** "trade" | "merchant" | "trade-center-support". */
  kind: "trade" | "merchant" | "trade-center-support";
  /** Initials for the avatar fallback. */
  initials: string;
  /** Optional avatar / logo URL. */
  avatarUrl?: string;
};

export type MessageAttachment =
  | { kind: "product"; productSlug: string }
  | { kind: "merchant"; merchantSlug: string }
  | { kind: "job"; jobSlug: string }
  | { kind: "quote"; label: string; totalGbp: number }
  | { kind: "image"; url: string; alt?: string };

export type Message = {
  id: string;
  threadId: string;
  authorSlug: string;
  body: string;
  sentAtIso: string;
  attachments?: MessageAttachment[];
  /** Only present on system messages (WA handoff record, quote sent, etc.) */
  systemKind?: "whatsapp-handoff" | "quote-sent" | "order-placed" | "job-linked";
};

export type MessageThread = {
  id: string;
  /** Two-participant threads only in MVP week 1. */
  participants: Participant[];
  /** Optional deep-context — the product / merchant / job the thread
   *  is about. Threads compose in the inbox by context. */
  context?: {
    kind: "product" | "merchant" | "job" | "general";
    label: string;
    href?: string;
  };
  lastMessagePreview: string;
  lastMessageAtIso: string;
  unreadCountForViewer: number;
  merchantWhatsAppExposed?: boolean;
  merchantWhatsAppE164?: string;   // "+441611234567" — stored, never displayed raw
};

// ─── Fixtures ────────────────────────────────────────────────────────
// Viewer is Bob Watson (bob-plastering) — see identity fixtures.

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

const BOB: Participant = {
  slug: "bob-plastering",
  name: "Bob Watson",
  kind: "trade",
  initials: "BW"
};

const MTD: Participant = {
  slug: "manchester-tools-direct",
  name: "Manchester Tools Direct",
  kind: "merchant",
  initials: "MT"
};

const LBS: Participant = {
  slug: "leeds-builders-supplies",
  name: "Leeds Builders Supplies",
  kind: "merchant",
  initials: "LB"
};

const GSC: Participant = {
  slug: "glasgow-scaffolding-co",
  name: "Glasgow Scaffolding Co",
  kind: "merchant",
  initials: "GS"
};

export const MESSAGE_THREAD_FIXTURES: MessageThread[] = [
  {
    id: "t-mtd-marshalltown",
    participants: [BOB, MTD],
    context: {
      kind: "product",
      label: "Marshalltown Finishing Trowel · 14\"",
      href: "/tc/trade-center/product/marshalltown-finishing-trowel-14"
    },
    lastMessagePreview: "Yeah the twin-pack is fine — will you get it here for Wednesday?",
    lastMessageAtIso: iso(9),
    unreadCountForViewer: 1,
    merchantWhatsAppExposed: true,
    merchantWhatsAppE164: "+441611234567"
  },
  {
    id: "t-lbs-general",
    participants: [BOB, LBS],
    context: {
      kind: "merchant",
      label: "Leeds Builders Supplies · trade account",
      href: "/tc/trade-center/merchant/leeds-builders-supplies"
    },
    lastMessagePreview: "Approved — 30-day account opened. Welcome aboard.",
    lastMessageAtIso: iso(240),
    unreadCountForViewer: 0,
    merchantWhatsAppExposed: false
  },
  {
    id: "t-gsc-watson-job",
    participants: [BOB, GSC],
    context: {
      kind: "job",
      label: "Watson full re-skim + hallway ceiling",
      href: "/tc/jobs/watson-full-reskim"
    },
    lastMessagePreview: "Scaffold going up Monday — I'll send the risk assessment by end of day Friday.",
    lastMessageAtIso: iso(1440),
    unreadCountForViewer: 0,
    merchantWhatsAppExposed: true,
    merchantWhatsAppE164: "+441413452223"
  }
];

export const MESSAGE_FIXTURES: Message[] = [
  // ─── Manchester Tools Direct — active trowel discussion
  { id: "m1", threadId: "t-mtd-marshalltown", authorSlug: "bob-plastering", body: "Hi — do you have the Marshalltown 14\" twin-pack in stock? Need it for Wednesday.", sentAtIso: iso(35) },
  { id: "m2", threadId: "t-mtd-marshalltown", authorSlug: "manchester-tools-direct", body: "Hi Bob, yes we've got 8 in — same-day dispatch on twin-packs before 2pm. Wednesday's fine.", sentAtIso: iso(31),
    attachments: [{ kind: "product", productSlug: "marshalltown-finishing-trowel-14" }] },
  { id: "m3", threadId: "t-mtd-marshalltown", authorSlug: "bob-plastering", body: "Nice one. What's the trade price on the twin-pack again?", sentAtIso: iso(24) },
  { id: "m4", threadId: "t-mtd-marshalltown", authorSlug: "manchester-tools-direct", body: "£52 net for two — save you £8 over singles.", sentAtIso: iso(19),
    attachments: [{ kind: "quote", label: "Trowel twin-pack quote", totalGbp: 52 }] },
  { id: "m5", threadId: "t-mtd-marshalltown", authorSlug: "manchester-tools-direct", body: "Yeah the twin-pack is fine — will you get it here for Wednesday?", sentAtIso: iso(9) },

  // ─── Leeds Builders Supplies — trade account approval
  { id: "m10", threadId: "t-lbs-general", authorSlug: "bob-plastering", body: "Submitted the trade account application. Anything else you need from me?", sentAtIso: iso(480) },
  { id: "m11", threadId: "t-lbs-general", authorSlug: "leeds-builders-supplies", body: "All good — we've got everything via your Verified Trade Identity. Approving now.", sentAtIso: iso(340) },
  { id: "m12", threadId: "t-lbs-general", authorSlug: "leeds-builders-supplies", body: "Approved — 30-day account opened. Welcome aboard.", sentAtIso: iso(240) },

  // ─── Glasgow Scaffolding — Watson job coordination
  { id: "m20", threadId: "t-gsc-watson-job", authorSlug: "bob-plastering", body: "Got a re-skim on a 4-storey — need scaffold Monday to Thursday. Can you quote?", sentAtIso: iso(4320),
    attachments: [{ kind: "job", jobSlug: "watson-full-reskim" }] },
  { id: "m21", threadId: "t-gsc-watson-job", authorSlug: "glasgow-scaffolding-co", body: "Yes — priced at £480 for the week, includes erection and dismantle. Risk assessment included.", sentAtIso: iso(2880),
    attachments: [{ kind: "quote", label: "Scaffold — Watson job", totalGbp: 480 }] },
  { id: "m22", threadId: "t-gsc-watson-job", authorSlug: "bob-plastering", body: "Go for it. Any deposit?", sentAtIso: iso(2100) },
  { id: "m23", threadId: "t-gsc-watson-job", authorSlug: "glasgow-scaffolding-co", body: "No deposit needed — pay on completion via Trade Center.", sentAtIso: iso(1800) },
  { id: "m24", threadId: "t-gsc-watson-job", authorSlug: "glasgow-scaffolding-co", body: "Scaffold going up Monday — I'll send the risk assessment by end of day Friday.", sentAtIso: iso(1440) }
];

export function findThread(id: string): MessageThread | undefined {
  return MESSAGE_THREAD_FIXTURES.find((t) => t.id === id);
}

export function messagesForThread(threadId: string): Message[] {
  return MESSAGE_FIXTURES.filter((m) => m.threadId === threadId).sort(
    (a, b) => new Date(a.sentAtIso).getTime() - new Date(b.sentAtIso).getTime()
  );
}

export function threadsForViewer(viewerSlug: string): MessageThread[] {
  return MESSAGE_THREAD_FIXTURES.filter((t) =>
    t.participants.some((p) => p.slug === viewerSlug)
  ).sort(
    (a, b) => new Date(b.lastMessageAtIso).getTime() - new Date(a.lastMessageAtIso).getTime()
  );
}

/** Given a thread + viewer, return the OTHER participant. */
export function otherParticipant(thread: MessageThread, viewerSlug: string): Participant | undefined {
  return thread.participants.find((p) => p.slug !== viewerSlug);
}

/** Format the E164 WhatsApp number into a wa.me deep-link with an
 *  optional first-message payload. */
export function whatsappLinkFor(e164: string, initialText?: string): string {
  const clean = e164.replace(/[^\d]/g, "");
  const q = initialText ? `?text=${encodeURIComponent(initialText)}` : "";
  return `https://wa.me/${clean}${q}`;
}
