// contact.split_1 — form left, contact panel right.
//
// Native HTML form POST — merchant pastes their Formspree /
// Formsubmit.co / merchant-endpoint action URL and the browser handles
// submission. Right column carries a WhatsApp CTA (uses the merchant's
// registered number via data.whatsappHref), phone + email fallbacks,
// and opening hours.
//
// On mobile stacks form-then-panel; on desktop 60/40 split.

import Link from "next/link";
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
  formActionUrl: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  messagePlaceholder: string;
  showPhoneField: boolean;
  submitLabel: string;
  whatsappCtaLabel: string;
  phoneNumber: string;
  emailAddress: string;
  hoursLabel: string;
  hoursValue: string;
};

function ContactSplit({
  instanceId,
  config,
  tokens,
  data,
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
  const whatsappHref = data.whatsappHref ?? "#";
  const telHref = config.phoneNumber
    ? `tel:${config.phoneNumber.replace(/[^\d+]/g, "")}`
    : "#";
  const mailHref = config.emailAddress
    ? `mailto:${config.emailAddress}`
    : "#";

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "contact.split_1", "Contact")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
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
              className="mt-3 max-w-2xl text-[14px] leading-relaxed sm:text-[16px]"
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
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Form (3/5 wide on desktop) */}
          <form
            action={hasAction ? config.formActionUrl : undefined}
            method="post"
            className="col-span-1 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-3"
          >
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder={config.namePlaceholder || "Your name"}
                aria-label="Your name"
                disabled={isEditing || !hasAction}
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[14px] text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder={config.emailPlaceholder || "you@email.com"}
                aria-label="Your email"
                disabled={isEditing || !hasAction}
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[14px] text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
              />
            </div>
            {config.showPhoneField && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder={config.phonePlaceholder || "07…"}
                  aria-label="Your phone"
                  disabled={isEditing || !hasAction}
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[14px] text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Message
              </label>
              <textarea
                name="message"
                required
                rows={4}
                placeholder={
                  config.messagePlaceholder ||
                  "What's the job? Photos help — attach in the reply."
                }
                aria-label="Your message"
                disabled={isEditing || !hasAction}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-3 text-[14px] text-neutral-900 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-50"
              />
            </div>
            <button
              type="submit"
              disabled={isEditing || !hasAction}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(instanceId, "submitLabel", "Submit button", "button")}
            >
              {config.submitLabel || "Send message"} →
            </button>
            {isEditing && !hasAction && (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800"
              >
                Add your Formspree / Formsubmit / merchant endpoint URL
                in Form action URL for real submissions.
              </p>
            )}
          </form>

          {/* Contact panel (2/5 wide on desktop) */}
          <div className="col-span-1 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 lg:col-span-2">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: accent }}
            >
              Prefer to skip the form?
            </p>
            <Link
              href={whatsappHref}
              className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
              style={{ background: "#25D366" }}
              {...treeAttrs(instanceId, "whatsappCtaLabel", "WhatsApp button", "button")}
            >
              {config.whatsappCtaLabel || "💬 WhatsApp"}
            </Link>
            {config.phoneNumber && (
              <Link
                href={telHref}
                className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-[13px] font-bold transition hover:bg-neutral-100"
                style={{ color: text }}
                {...treeAttrs(instanceId, "phoneNumber", "Phone", "text")}
              >
                📞 {config.phoneNumber}
              </Link>
            )}
            {config.emailAddress && (
              <Link
                href={mailHref}
                className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-[13px] font-bold transition hover:bg-neutral-100"
                style={{ color: text }}
                {...treeAttrs(instanceId, "emailAddress", "Email", "text")}
              >
                ✉ {config.emailAddress}
              </Link>
            )}
            {config.hoursValue && (
              <div className="mt-2 border-t border-neutral-200 pt-3">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: muted }}
                  {...treeAttrs(instanceId, "hoursLabel", "Hours label", "text")}
                >
                  {config.hoursLabel || "Opening hours"}
                </p>
                <p
                  className="mt-1 text-[12px] leading-relaxed"
                  style={{ color: text, fontFamily: bodyFont }}
                  {...treeAttrs(instanceId, "hoursValue", "Hours", "text")}
                >
                  {config.hoursValue}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "contact.split_1",
  name: "Contact form + panel",
  version: "1.0.0",
  library: "contact",
  description:
    "Form on the left (name / email / phone / message), contact info panel on the right (WhatsApp CTA + phone + email + hours). Native HTML POST — no JavaScript. Stacks on mobile.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Get in touch", priority: "text", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Tell us about the job.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "We reply within one working hour, Mon-Sat. Photos of the problem help us quote accurately.", priority: "text", aiPromptable: true, group: "Copy" },

    { key: "formActionUrl", label: "Form action URL", type: { kind: "link", allowInternal: false, allowExternal: true }, default: "", description: "Paste your Formspree / Formsubmit / merchant endpoint URL.", group: "Form" },
    { key: "namePlaceholder", label: "Name placeholder", type: { kind: "text", maxLength: 40 }, default: "Your name", group: "Form" },
    { key: "emailPlaceholder", label: "Email placeholder", type: { kind: "text", maxLength: 40 }, default: "you@email.com", group: "Form" },
    { key: "phonePlaceholder", label: "Phone placeholder", type: { kind: "text", maxLength: 40 }, default: "07…", group: "Form" },
    { key: "showPhoneField", label: "Show phone field", type: { kind: "boolean" }, default: true, group: "Form" },
    { key: "messagePlaceholder", label: "Message placeholder", type: { kind: "text", maxLength: 140 }, default: "What's the job? Photos help — attach in the reply.", group: "Form" },
    { key: "submitLabel", label: "Submit button text", type: { kind: "text", maxLength: 24 }, default: "Send message", priority: "button", group: "Form" },

    { key: "whatsappCtaLabel", label: "WhatsApp button text", type: { kind: "text", maxLength: 24 }, default: "💬 WhatsApp", priority: "button", group: "Panel" },
    { key: "phoneNumber", label: "Phone number", type: { kind: "text", maxLength: 40 }, default: "0800 000 0000", priority: "text", group: "Panel" },
    { key: "emailAddress", label: "Email address", type: { kind: "text", maxLength: 80 }, default: "hello@yourbusiness.co.uk", priority: "text", group: "Panel" },
    { key: "hoursLabel", label: "Hours label", type: { kind: "text", maxLength: 40 }, default: "Opening hours", priority: "text", group: "Panel" },
    { key: "hoursValue", label: "Hours value", type: { kind: "text", maxLength: 120, multiline: true }, default: "Mon-Fri 07:30-18:00 · Sat 08:00-14:00 · Emergency line 24/7", priority: "text", aiPromptable: true, group: "Panel" }
  ],
  animations: ["none", "fade"],
  aiPrompts: {
    explain: "Explain why a contact form + panel works for UK trades. Reference specific copy.",
    improve: "Improve without layout change. Headline under 6 words. Sub-line one sentence. Return only patched config.",
    rewrite: "Rewrite copy in a {tone} voice.",
    suggestAlternative: "Suggest an alternative contact layout from library='contact'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/contact-split-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true },
    seo: { headingLevel: 2, structuredData: "ContactPage" },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["contact", "split", "form_left_panel_right", "no_js", "external_action"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery", "plant_hire", "tool_hire", "building_merchant", "kitchen_install", "bathroom_install", "handyman"],
  defaultConfig: () => ({
    eyebrow: "Get in touch",
    heading: "Tell us about the job.",
    subheading: "We reply within one working hour, Mon-Sat. Photos of the problem help us quote accurately.",
    formActionUrl: "",
    namePlaceholder: "Your name",
    emailPlaceholder: "you@email.com",
    phonePlaceholder: "07…",
    showPhoneField: true,
    messagePlaceholder: "What's the job? Photos help — attach in the reply.",
    submitLabel: "Send message",
    whatsappCtaLabel: "💬 WhatsApp",
    phoneNumber: "0800 000 0000",
    emailAddress: "hello@yourbusiness.co.uk",
    hoursLabel: "Opening hours",
    hoursValue: "Mon-Fri 07:30-18:00 · Sat 08:00-14:00 · Emergency line 24/7"
  }),
  renderer: ContactSplit
};

sectionRegistry.register(registration);
