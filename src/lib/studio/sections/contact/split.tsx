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
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
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

export function ContactSplit({
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
                      style={{ background: "rgba(22,101,52,0.12)", color: "#166534" }}
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

