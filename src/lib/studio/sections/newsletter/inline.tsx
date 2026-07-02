// newsletter.inline_1 — email capture with an external form action.
//
// Native HTML form POST — no client JavaScript. Merchant pastes their
// Mailchimp / ConvertKit / Brevo action URL into `formActionUrl`
// (external providers accept form submissions directly). Empty URL
// renders a "configure a service" hint in edit mode and a disabled
// button in preview / published.
//
// Best in-page between an FAQ and a CTA — merchants who want seasonal
// / promo drip campaigns without building a custom subscribe API.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  emailPlaceholder: string;
  buttonLabel: string;
  formActionUrl: string;
  showTrustLine: boolean;
  trustLine: string;
};

function NewsletterInline({
  instanceId,
  config,
  tokens,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";
  const hasAction = Boolean(config.formActionUrl);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "newsletter.inline_1", "Newsletter")}
    >
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        {config.heading && (
          <h2
            className="mt-2 text-3xl leading-tight sm:text-4xl"
            style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {config.heading}
          </h2>
        )}
        {config.subheading && (
          <p
            className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed sm:text-[16px]"
            style={{
              color: muted,
              fontFamily: bodyFont,
              fontWeight: bodyWeight ?? 500
            }}
            {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
          >
            {config.subheading}
          </p>
        )}

        <form
          action={hasAction ? config.formActionUrl : undefined}
          method="post"
          target="_blank"
          className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            name="email"
            required
            placeholder={config.emailPlaceholder || "your@email.com"}
            aria-label="Your email"
            disabled={isEditing || !hasAction}
            className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-[14px] font-medium text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500"
          />
          <button
            type="submit"
            disabled={isEditing || !hasAction}
            className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: accent, color: "#0A0A0A" }}
            {...treeAttrs(instanceId, "buttonLabel", "Subscribe button", "button")}
          >
            {config.buttonLabel || "Subscribe"} →
          </button>
        </form>

        {isEditing && !hasAction && (
          <p
            role="alert"
            className="mx-auto mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800"
          >
            Add your Mailchimp / ConvertKit / Brevo form URL in the Form
            action URL field for real submissions.
          </p>
        )}

        {config.showTrustLine && config.trustLine && (
          <p
            className="mx-auto mt-4 max-w-md text-[11px] font-bold uppercase tracking-widest"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "trustLine", "Trust line", "text")}
          >
            {config.trustLine}
          </p>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "newsletter.inline_1",
  name: "Newsletter signup",
  version: "1.0.0",
  library: "newsletter",
  description:
    "Centred email capture with a configurable form action URL. Native HTML POST — no JavaScript needed. Merchant pastes their Mailchimp / ConvertKit / Brevo form URL; the section handles the submit.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Stay in touch", priority: "text", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Seasonal tips, no spam.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "One email a month with maintenance reminders, promo work, and cold-snap prep. Unsubscribe any time.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "emailPlaceholder", label: "Email placeholder", type: { kind: "text", maxLength: 40 }, default: "your@email.com", group: "Form" },
    { key: "buttonLabel", label: "Subscribe button text", type: { kind: "text", maxLength: 24 }, default: "Subscribe", priority: "button", group: "Form" },
    { key: "formActionUrl", label: "Form action URL", type: { kind: "link", allowInternal: false, allowExternal: true }, default: "", description: "Paste your Mailchimp / ConvertKit / Brevo form URL.", group: "Form" },
    { key: "showTrustLine", label: "Show trust line", type: { kind: "boolean" }, default: true, group: "Trust" },
    { key: "trustLine", label: "Trust line copy", type: { kind: "text", maxLength: 80 }, default: "No spam · Unsubscribe any time · GDPR compliant", priority: "text", aiPromptable: true, group: "Trust" }
  ],
  animations: ["none", "fade"],
  aiPrompts: {
    explain: "Explain why a UK trade merchant benefits from a monthly newsletter. Reference the copy specifics.",
    improve: "Improve without layout change. Headline under 6 words. Sub-line under 20 words. Trust line 3-4 short claims. Return only patched config.",
    rewrite: "Rewrite copy in a {tone} voice.",
    suggestAlternative: "Suggest an alternative newsletter layout from library='newsletter'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/newsletter-inline-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["newsletter", "inline", "email_capture", "no_js", "external_action"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery", "plant_hire", "kitchen_install", "bathroom_install", "handyman"],
  defaultConfig: () => ({
    eyebrow: "Stay in touch",
    heading: "Seasonal tips, no spam.",
    subheading: "One email a month with maintenance reminders, promo work, and cold-snap prep. Unsubscribe any time.",
    emailPlaceholder: "your@email.com",
    buttonLabel: "Subscribe",
    formActionUrl: "",
    showTrustLine: true,
    trustLine: "No spam · Unsubscribe any time · GDPR compliant"
  }),
  renderer: NewsletterInline
};

sectionRegistry.register(registration);
