// contact.split_1 — Phase 2 rebuild on shadcn foundation.
//
// Left column: form with shadcn-styled inputs + Framer Motion Reveal.
// Right column: WhatsApp CTA + phone + email + opening hours panel.
// Mobile: stacks form-then-panel; Desktop: 60/40 grid.
//
// Native HTML form POST — merchant provides their Formspree /
// Formsubmit.co / merchant-endpoint action URL.

"use client";

import Link from "next/link";
import { Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { ContactForm } from "./_ContactForm";

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
  ctaLabel: string;
  consentLine: string;
  whatsappCtaLabel: string;
  phoneNumber: string;
  emailAddress: string;
  hoursLabel: string;
  hoursValue: string;
  surface: "light" | "dark";
};

function ContactSplit({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const isEditing = mode === "edit";

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = typeof config.heading === "string" ? config.heading : "Get in touch";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const formActionUrl = typeof config.formActionUrl === "string" ? config.formActionUrl : "";
  const namePlaceholder = typeof config.namePlaceholder === "string" ? config.namePlaceholder : "Your name";
  const emailPlaceholder = typeof config.emailPlaceholder === "string" ? config.emailPlaceholder : "you@email.com";
  const phonePlaceholder = typeof config.phonePlaceholder === "string" ? config.phonePlaceholder : "07…";
  const messagePlaceholder = typeof config.messagePlaceholder === "string" ? config.messagePlaceholder : "What's the job?";
  const showPhoneField = config.showPhoneField !== false;
  const submitLabel = (typeof config.submitLabel === "string" && config.submitLabel) || (typeof config.ctaLabel === "string" && config.ctaLabel) || "Send message";
  const consentLine = typeof config.consentLine === "string" ? config.consentLine : "";

  const whatsappCtaLabel = (typeof config.whatsappCtaLabel === "string" && config.whatsappCtaLabel) || "WhatsApp us";
  const phoneNumber = typeof config.phoneNumber === "string" ? config.phoneNumber : "";
  const emailAddress = typeof config.emailAddress === "string" ? config.emailAddress : "";
  const hoursLabel = (typeof config.hoursLabel === "string" && config.hoursLabel) || "Opening hours";
  const hoursValue = typeof config.hoursValue === "string" ? config.hoursValue : "";

  const whatsappHref = data.whatsappHref ?? "#whatsapp";

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "contact.split_1", "Contact · split")}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        {/* Header */}
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          {eyebrow && (
            <Reveal>
              <p
                className="text-eyebrow font-extrabold uppercase"
                style={{ color: accent }}
                {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
              >
                {eyebrow}
              </p>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <h2
              className="mt-3 text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
              {...treeAttrs(instanceId, "heading", "Heading", "text")}
            >
              {heading}
            </h2>
          </Reveal>
          {subheading && (
            <Reveal delay={0.1}>
              <p
                className="mt-3 max-w-2xl text-body-md text-muted-foreground sm:text-body-lg"
                {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
              >
                {subheading}
              </p>
            </Reveal>
          )}
        </div>

        {/* Body — form (left) + panel (right) */}
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
          {/* Form */}
          <Reveal delay={0.15}>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                {/* RHF + Zod validation with a native POST fallback so
                    the merchant's Formspree / custom endpoint continues
                    to receive submissions. See ./_ContactForm.tsx. */}
                <ContactForm
                  formActionUrl={formActionUrl}
                  namePlaceholder={namePlaceholder}
                  emailPlaceholder={emailPlaceholder}
                  phonePlaceholder={phonePlaceholder}
                  messagePlaceholder={messagePlaceholder}
                  showPhoneField={showPhoneField}
                  submitLabel={submitLabel}
                  consentLine={consentLine}
                  accent={accent}
                  disabled={isEditing}
                />
              </CardContent>
            </Card>
          </Reveal>

          {/* Contact panel */}
          <Reveal delay={0.22}>
            <div className="flex h-full flex-col gap-3">
              {/* WhatsApp CTA */}
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "rgba(37,211,102,0.12)", color: "#25D366" }}
                    >
                      <MessageCircle strokeWidth={2.25} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-extrabold uppercase text-muted-foreground">
                        Prefer to skip the form?
                      </p>
                      <Link
                        href={whatsappHref}
                        className="mt-1 inline-flex items-center gap-1.5 text-heading-sm font-extrabold text-foreground hover:text-primary"
                        {...treeAttrs(
                          instanceId,
                          "whatsappCtaLabel",
                          "WhatsApp CTA",
                          "button"
                        )}
                      >
                        {whatsappCtaLabel}
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Phone + email quick-actions */}
              {(phoneNumber || emailAddress) && (
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-5">
                    {phoneNumber && (
                      <Link
                        href={`tel:${phoneNumber.replace(/\s+/g, "")}`}
                        className="group flex items-center gap-3 text-foreground hover:text-primary"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${accent}14`, color: accent }}
                        >
                          <Phone strokeWidth={2.25} size={18} />
                        </div>
                        <span
                          className="text-body-md font-extrabold"
                          {...treeAttrs(
                            instanceId,
                            "phoneNumber",
                            "Phone",
                            "text"
                          )}
                        >
                          {phoneNumber}
                        </span>
                      </Link>
                    )}
                    {emailAddress && (
                      <Link
                        href={`mailto:${emailAddress}`}
                        className="group flex items-center gap-3 text-foreground hover:text-primary"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${accent}14`, color: accent }}
                        >
                          <Mail strokeWidth={2.25} size={18} />
                        </div>
                        <span
                          className="min-w-0 truncate text-body-md font-extrabold"
                          {...treeAttrs(
                            instanceId,
                            "emailAddress",
                            "Email",
                            "text"
                          )}
                        >
                          {emailAddress}
                        </span>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Hours */}
              {hoursValue && (
                <Card className="border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${accent}14`, color: accent }}
                      >
                        <Clock strokeWidth={2.25} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-caption font-extrabold uppercase text-muted-foreground"
                          {...treeAttrs(instanceId, "hoursLabel", "Hours label", "text")}
                        >
                          {hoursLabel}
                        </p>
                        <p
                          className="mt-1 text-body-sm text-foreground"
                          {...treeAttrs(instanceId, "hoursValue", "Hours value", "text")}
                        >
                          {hoursValue}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "contact.split_1",
  name: "Contact · split",
  version: "2.0.0",
  library: "contact",
  description:
    "Contact form + panel side-by-side on shadcn Card + Framer Motion. Form left, WhatsApp + phone + email + hours cards right. Mobile: stacks. Desktop: 60/40 grid.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Get in touch", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 80 }, default: "Book a quote", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "We reply within one working hour, Mon-Sat. Photos of the problem help us quote accurately.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "formActionUrl", label: "Form action URL", type: { kind: "link", allowExternal: true }, default: "", description: "Formspree / Formsubmit.co / your endpoint. Leave blank for demo mode.", group: "Form" },
    { key: "namePlaceholder", label: "Name placeholder", type: { kind: "text", maxLength: 30 }, default: "Your name", group: "Form" },
    { key: "emailPlaceholder", label: "Email placeholder", type: { kind: "text", maxLength: 30 }, default: "you@email.com", group: "Form" },
    { key: "phonePlaceholder", label: "Phone placeholder", type: { kind: "text", maxLength: 30 }, default: "07…", group: "Form" },
    { key: "messagePlaceholder", label: "Message placeholder", type: { kind: "text", maxLength: 100, multiline: true }, default: "What's the job? Photos help — attach in the reply.", group: "Form" },
    { key: "showPhoneField", label: "Show phone field", type: { kind: "boolean" }, default: true, group: "Form" },
    { key: "submitLabel", label: "Submit label", type: { kind: "text", maxLength: 30 }, default: "Send message", priority: "button", role: "primary_action_label", group: "Form" },
    { key: "consentLine", label: "Consent line", type: { kind: "text", maxLength: 100 }, default: "We reply within 4 working hours.", priority: "text", role: "disclaimer", group: "Form" },
    { key: "whatsappCtaLabel", label: "WhatsApp CTA", type: { kind: "text", maxLength: 30 }, default: "WhatsApp us", priority: "button", role: "cta_whatsapp", group: "Panel" },
    { key: "phoneNumber", label: "Phone number", type: { kind: "text", maxLength: 40 }, default: "0800 000 0000", priority: "text", role: "cta_call", group: "Panel" },
    { key: "emailAddress", label: "Email address", type: { kind: "text", maxLength: 60 }, default: "hello@yourbusiness.co.uk", priority: "text", role: "cta_email", group: "Panel" },
    { key: "hoursLabel", label: "Hours label", type: { kind: "text", maxLength: 30 }, default: "Opening hours", priority: "text", group: "Panel" },
    { key: "hoursValue", label: "Hours value", type: { kind: "text", maxLength: 140, multiline: true }, default: "Mon-Fri 07:30-18:00 · Sat 08:00-14:00 · Emergency line 24/7", priority: "text", group: "Panel" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ] as unknown as SectionRegistration<Config>["editableFields"],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A contact split section. Explain when this beats a single call-to-action.",
    improve: "Tighten heading + subheading. Return patched fields only.",
    rewrite: "Rewrite heading + subheading in a {tone} voice.",
    suggestAlternative: "Suggest an alternative when the merchant only wants WhatsApp.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["contact", "form", "split", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "handyman", "landscaper", "extension-builder"],
  defaultConfig: () => ({
    eyebrow: "Get in touch",
    heading: "Book a quote",
    subheading: "We reply within one working hour, Mon-Sat. Photos of the problem help us quote accurately.",
    formActionUrl: "",
    namePlaceholder: "Your name",
    emailPlaceholder: "you@email.com",
    phonePlaceholder: "07…",
    messagePlaceholder: "What's the job? Photos help — attach in the reply.",
    showPhoneField: true,
    submitLabel: "Send message",
    ctaLabel: "Send message",
    consentLine: "We reply within 4 working hours.",
    whatsappCtaLabel: "WhatsApp us",
    phoneNumber: "0800 000 0000",
    emailAddress: "hello@yourbusiness.co.uk",
    hoursLabel: "Opening hours",
    hoursValue: "Mon-Fri 07:30-18:00 · Sat 08:00-14:00 · Emergency line 24/7",
    surface: "light"
  }),
  renderer: ContactSplit
};

sectionRegistry.register(registration);
