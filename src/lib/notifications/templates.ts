// Notification templates registry.
//
// Each template has: slug, subject, body (with {{placeholders}}),
// optional actionUrl, optional icon slug (Lucide name for in-app).
//
// Add a template = add an entry here. Every product references by slug,
// never by copy — so operational rewrites don't require code changes
// at every call site.

export type TemplateSlug =
  | "homeowner.welcome"
  | "homeowner.trade_replied"
  | "trade.invite_received"
  | "trade.beacon_alert"
  | "trade.apprentice_alert"
  | "merchant.tier_upgraded"
  | "merchant.subscription_charged"
  | "home_care.reminder"
  | "sitebook.export_ready"
  | "admin.action_required";

type Template = {
  subject:   string;
  body:      string;
  actionUrl: string | null;
  iconSlug:  string | null;
};

const TEMPLATES: Record<TemplateSlug, Template> = {
  "homeowner.welcome": {
    subject:   "Welcome to your SiteBook, {{firstName}}",
    body:      `Hi {{firstName}},

Your SiteBook is live. Two things to try first:

1. Post your project — describe what you need done. Photos help.
2. Invite the trades you know — even one is enough to get replies flowing.

Any question, hit reply. This inbox goes to a real person.

— The Networkers`,
    actionUrl: "/sitebook",
    iconSlug:  "HardHat"
  },
  "homeowner.trade_replied": {
    subject:   "{{tradeName}} replied on your SiteBook",
    body:      `{{tradeName}} just replied to your post "{{postTitle}}".

Open your SiteBook to see the full message and reply back.`,
    actionUrl: "/sitebook",
    iconSlug:  "MessageCircle"
  },
  "trade.invite_received": {
    subject:   "{{homeownerName}} invited you to a project",
    body:      `{{homeownerName}} sent you a project invitation on TheNetworkers.

Project: {{projectTitle}}
Location: {{city}}

No signup needed — reply directly from the link.`,
    actionUrl: "{{inviteUrl}}",
    iconSlug:  "MessageCircle"
  },
  "trade.beacon_alert": {
    subject:   "New {{tradeCategory}} job in {{city}}",
    body:      `A homeowner just posted:

{{postTitle}}

Location: {{city}} · Posted just now

Respond within the hour to be first.`,
    actionUrl: "{{beaconUrl}}",
    iconSlug:  "Radio"
  },
  "trade.apprentice_alert": {
    subject:   "New apprentice looking for a {{tradeName}} in {{city}}",
    body:      `A young person just posted an apprenticeship request:

{{firstName}} ({{age}}) — looking to learn as a {{tradeName}}
Location: {{city}}
{{summary}}

Reveal contact for 1 washer. First reply usually wins.

The Networkers supports UK trade youth — every apprentice we place is a future networker.`,
    actionUrl: "{{requestUrl}}",
    iconSlug:  "GraduationCap"
  },
  "merchant.tier_upgraded": {
    subject:   "Your TheNetworkers plan is now {{newTier}}",
    body:      `Your subscription is now on the {{newTier}} plan.

New this month: {{washersMonthly}} washers, {{extraFeatures}}.

Manage your subscription in Studio.`,
    actionUrl: "/trade-off/edit/{{merchantSlug}}",
    iconSlug:  "Wallet"
  },
  "merchant.subscription_charged": {
    subject:   "Receipt · TheNetworkers £{{amount}}",
    body:      `Thanks — your {{tier}} subscription renewed for £{{amount}}.

Receipt attached. Next charge: {{nextChargeDate}}.`,
    actionUrl: "/trade-off/edit/{{merchantSlug}}",
    iconSlug:  "Wallet"
  },
  "home_care.reminder": {
    subject:   "{{maintenanceTitle}} is due soon",
    body:      `Reminder: your {{maintenanceTitle}} is due {{dueLabel}}.

Last done: {{lastDoneAt}} by {{lastTradeName}}.

Rebook in one tap from your SiteBook.`,
    actionUrl: "/sitebook",
    iconSlug:  "CalendarClock"
  },
  "sitebook.export_ready": {
    subject:   "Your SiteBook export is ready",
    body:      `Your {{projectTitle}} export is ready to download.

Link expires in 7 days. Save it to your files or forward to your buyer/next owner.`,
    actionUrl: "{{downloadUrl}}",
    iconSlug:  "FileText"
  },
  "admin.action_required": {
    subject:   "Admin action · {{topic}}",
    body:      `Attention: {{message}}

Check the admin dashboard for details.`,
    actionUrl: "/admin",
    iconSlug:  "AlertTriangle"
  }
};

/** Render a template with data. Missing variables render as empty strings. */
export function renderTemplate(slug: TemplateSlug, data: Record<string, unknown>): {
  subject: string; body: string; actionUrl: string | null; iconSlug: string | null;
} {
  const t = TEMPLATES[slug];
  if (!t) {
    return { subject: `[missing template: ${slug}]`, body: "", actionUrl: null, iconSlug: null };
  }
  return {
    subject:   interpolate(t.subject,   data),
    body:      interpolate(t.body,      data),
    actionUrl: t.actionUrl ? interpolate(t.actionUrl, data) : null,
    iconSlug:  t.iconSlug
  };
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}
