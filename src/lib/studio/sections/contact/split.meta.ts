// Metadata sidecar for contact.split_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { ContactSplit } from "./split";

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
