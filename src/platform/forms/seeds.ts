// formRegistry — 6 seed forms.
//
// Every form declares BUSINESS INTENT and consumed facets. The
// runtime renderer reads the ResolvedStrategy to adapt fields,
// submit labels, and follow-up workflows.

import { formRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── 1. Contact ───────────────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "contact",
  name: "Contact",
  description:
    "General contact form. Adapts submit label from cta.primary; fires the follow-up workflow declared by the resolved strategy.",
  version: "1.0.0",
  purpose: "contact",
  intent: "start-conversation",
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "form.submitLabel", optional: true },
    { kind: "form.successMessage", optional: true },
    { kind: "form.followupWorkflow", optional: true },
    { kind: "form.hideFields", optional: true }
  ],
  fields: [
    { key: "name", label: "Your name", kind: "text", required: true, validation: { minLength: 2, maxLength: 80 } },
    { key: "email", label: "Email", kind: "email", required: true },
    { key: "phone", label: "Phone", kind: "tel", required: false },
    { key: "message", label: "Message", kind: "textarea", required: true, validation: { minLength: 8, maxLength: 2000 } }
  ],
  submit: { kind: "supabase-table", table: "studio_form_submissions" },
  successBehaviour: { kind: "inline", messageIntent: "thank-you" },
  consentLine:
    "By sending you agree to our privacy policy. We reply within 1 working day.",
  appliesTo: { trades: ["*"] },
  publisher: P
});

// ─── 2. Quote Request ─────────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "quote-request",
  name: "Quote Request",
  description:
    "Structured quote request. Service dropdown ordered by strategy.pushServices. Postcode + budget conditional on pricing.display.",
  version: "1.0.0",
  purpose: "quote-request",
  intent: "collect-quote-brief",
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "pricing.display", optional: true },
    { kind: "form.submitLabel", optional: true },
    { kind: "form.emphasiseFields", optional: true },
    { kind: "form.hideFields", optional: true },
    { kind: "form.followupWorkflow", optional: true }
  ],
  fields: [
    { key: "name", label: "Your name", kind: "text", required: true, validation: { minLength: 2, maxLength: 80 } },
    { key: "email", label: "Email", kind: "email", required: true },
    { key: "phone", label: "Phone", kind: "tel", required: true },
    { key: "postcode", label: "Postcode", kind: "postcode", required: true, validation: { maxLength: 12 } },
    {
      key: "service",
      label: "Which service?",
      kind: "select",
      required: true,
      optionsFrom: { source: "strategy-push-services" },
      description: "Not sure? Just pick the closest — we'll clarify on the call."
    },
    {
      key: "budget",
      label: "Rough budget",
      kind: "select",
      required: false,
      options: [
        { value: "under-1k", label: "Under £1,000" },
        { value: "1k-5k", label: "£1,000 – £5,000" },
        { value: "5k-15k", label: "£5,000 – £15,000" },
        { value: "15k-50k", label: "£15,000 – £50,000" },
        { value: "50k-plus", label: "£50,000+" }
      ],
      visibleWhen: {
        kind: "facet",
        domain: "pricing",
        field: "display",
        equals: "hidden"
      }
    },
    { key: "message", label: "Anything else?", kind: "textarea", required: false, validation: { maxLength: 2000 } }
  ],
  submit: { kind: "supabase-table", table: "studio_form_submissions" },
  successBehaviour: { kind: "inline", messageIntent: "quote-received" },
  consentLine:
    "By submitting you agree to us contacting you about your quote. We never share your details.",
  appliesTo: {
    trades: ["*"],
    growthGoals: [
      "increase-average-job-value",
      "lead-generation",
      "quotes"
    ]
  },
  publisher: P
});

// ─── 3. Callback Request ──────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "callback-request",
  name: "Callback Request",
  description:
    "Ultra-short callback form for emergency + response-first businesses. Best paired with an emergency-response playbook.",
  version: "1.0.0",
  purpose: "callback-request",
  intent: "get-me-a-call-fast",
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "form.submitLabel", optional: true },
    { kind: "form.followupWorkflow", optional: true }
  ],
  fields: [
    { key: "name", label: "Your name", kind: "text", required: true, validation: { minLength: 2, maxLength: 80 } },
    { key: "phone", label: "Phone", kind: "tel", required: true },
    { key: "postcode", label: "Postcode", kind: "postcode", required: false },
    {
      key: "urgency",
      label: "Urgency",
      kind: "radio-group",
      required: true,
      options: [
        { value: "asap", label: "ASAP — emergency" },
        { value: "today", label: "Today if possible" },
        { value: "this-week", label: "This week" }
      ]
    }
  ],
  submit: { kind: "supabase-table", table: "studio_form_submissions" },
  successBehaviour: { kind: "inline", messageIntent: "callback-confirmed" },
  appliesTo: {
    trades: ["*"],
    profileFlags: ["emergency"],
    growthGoals: ["bookings", "increase-conversion-rate"]
  },
  publisher: P
});

// ─── 4. Booking Info ──────────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "booking-info",
  name: "Booking Information",
  description:
    "Customer information step for a booking flow. Deposit checkbox shown conditionally on booking.depositPolicy facet.",
  version: "1.0.0",
  purpose: "booking-info",
  intent: "collect-booking-details",
  consumesFacets: [
    { kind: "cta.primary", optional: true },
    { kind: "form.submitLabel", optional: true },
    { kind: "form.emphasiseFields", optional: true }
  ],
  fields: [
    { key: "name", label: "Your name", kind: "text", required: true, validation: { minLength: 2, maxLength: 80 } },
    { key: "email", label: "Email", kind: "email", required: true },
    { key: "phone", label: "Phone", kind: "tel", required: true },
    { key: "postcode", label: "Address / postcode", kind: "text", required: true, validation: { maxLength: 200 } },
    { key: "notes", label: "Access notes", kind: "textarea", required: false, description: "Parking, gates, dogs, etc.", validation: { maxLength: 1000 } }
  ],
  submit: { kind: "custom", adapterId: "booking-info-adapter" },
  successBehaviour: { kind: "inline", messageIntent: "booking-confirmed" },
  appliesTo: {
    trades: ["*"],
    growthGoals: ["bookings"]
  },
  publisher: P
});

// ─── 5. Newsletter ────────────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "newsletter",
  name: "Newsletter",
  description:
    "Email capture for marketing campaigns declared by strategy.marketing.campaignTypes.",
  version: "1.0.0",
  purpose: "newsletter",
  intent: "grow-mailing-list",
  consumesFacets: [
    { kind: "form.submitLabel", optional: true },
    { kind: "marketing.campaignTypes", optional: true }
  ],
  fields: [
    { key: "email", label: "Email", kind: "email", required: true },
    {
      key: "consent",
      label: "I agree to receive occasional updates",
      kind: "checkbox",
      required: true
    }
  ],
  submit: { kind: "supabase-table", table: "studio_newsletter_subscribers" },
  successBehaviour: { kind: "inline", messageIntent: "subscribed" },
  appliesTo: { trades: ["*"] },
  publisher: P
});

// ─── 6. Review Submission ─────────────────────────────────────
formRegistry.register({
  manifestVersion: 1,
  slug: "review-submit",
  name: "Review Submission",
  description:
    "Post-job review form. Adapts to strategy — luxury businesses may want signed uploads; emergency businesses want speed.",
  version: "1.0.0",
  purpose: "review-submit",
  intent: "collect-customer-review",
  consumesFacets: [
    { kind: "form.submitLabel", optional: true },
    { kind: "form.emphasiseFields", optional: true }
  ],
  fields: [
    { key: "name", label: "Your name", kind: "text", required: true },
    { key: "rating", label: "Rating", kind: "radio-group", required: true, options: [
      { value: "5", label: "5 — Excellent" },
      { value: "4", label: "4 — Great" },
      { value: "3", label: "3 — Good" },
      { value: "2", label: "2 — Fair" },
      { value: "1", label: "1 — Poor" }
    ] },
    { key: "review", label: "Your review", kind: "textarea", required: true, validation: { minLength: 20, maxLength: 2000 } },
    { key: "photo", label: "Photo (optional)", kind: "photo-upload", required: false }
  ],
  submit: { kind: "supabase-table", table: "studio_reviews" },
  successBehaviour: { kind: "inline", messageIntent: "review-thanks" },
  appliesTo: {
    trades: ["*"],
    growthGoals: ["increase-reviews", "trust-building"]
  },
  publisher: P
});
