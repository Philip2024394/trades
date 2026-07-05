// Form Registry — types.
//
// Forms declare the BUSINESS INTENT they satisfy — not just fields.
// Every template lists the ResolvedStrategy facets it consumes; the
// runtime renderer reads those facets and adapts fields, submit
// labels, and follow-up workflows accordingly.
//
// A carpenter and an electrician can use the same underlying form
// component. The strategy determines which services appear first,
// which CTA text is shown, whether deposits are requested, and what
// automation fires after submit.

import type { ComponentType } from "react";

/** Field primitives — aligned with `@/components/ui/*`. */
export type FormFieldKind =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "multi-select"
  | "checkbox"
  | "radio-group"
  | "switch"
  | "file-upload"
  | "photo-upload"
  | "signature"
  | "postcode"
  | "address"
  | "hidden";

/** Visibility rules — a field renders when its condition matches. */
export type FieldVisibilityRule =
  /** Classic sibling-field condition. */
  | { kind: "field"; field: string; equals: unknown }
  /** Strategy-facet condition — reads from ResolvedStrategy. */
  | {
      kind: "facet";
      domain: string;
      field: string;
      equals?: unknown;
      exists?: boolean;
    }
  /** Profile flag condition — for premium/emergency/residential. */
  | { kind: "profileFlag"; flag: string; equals: boolean };

export type FormFieldDefinition = {
  key: string;
  label: string;
  kind: FormFieldKind;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: readonly { value: string; label: string }[];
  /** Optional visibility rule. When omitted, field always renders. */
  visibleWhen?: FieldVisibilityRule;
  /** Optional dynamic-option provider — reads options from strategy
   *  (e.g. services dropdown ordered by strategy.pushServices). */
  optionsFrom?:
    | { source: "strategy-push-services" }
    | { source: "profile-primary-services" }
    | { source: "profile-secondary-services" };
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    accept?: string;
  };
};

export type FormStep = {
  key: string;
  title: string;
  description?: string;
  fieldKeys: readonly string[];
};

export type FormSubmitAdapter =
  | { kind: "post-endpoint"; url: string }
  | { kind: "supabase-table"; table: string }
  | { kind: "formspree"; endpoint: string }
  | { kind: "custom"; adapterId: string };

/** Declaration of a facet a form consumes. Runtime enforces that the
 *  facet exists in facetKindRegistry. */
export type FormFacetConsumer = {
  /** Dotted facet kind — e.g. "cta.primary", "form.submitLabel". */
  kind: string;
  /** True = form falls back to default if facet not resolved. */
  optional: boolean;
  /** Fallback value if facet is absent. */
  fallback?: unknown;
};

/** Success behaviour — what happens after successful submit. */
export type FormSuccessBehaviour =
  | { kind: "toast"; messageIntent?: string }
  | { kind: "inline"; messageIntent?: string }
  | { kind: "redirect"; href: string };

export type FormManifest = {
  manifestVersion: 1;

  slug: string;
  name: string;
  description: string;
  version: string;

  /** Business purpose — contact / quote-request / callback /
   *  newsletter / booking-info / review / job-application / custom. */
  purpose: string;

  /** Business intent this form satisfies. Free-text, AI-consumable. */
  intent: string;

  /** ResolvedStrategy facets this form consumes. Every entry
   *  validated against facetKindRegistry at register time. */
  consumesFacets: readonly FormFacetConsumer[];

  fields: readonly FormFieldDefinition[];
  steps?: readonly FormStep[];
  submit: FormSubmitAdapter;
  successBehaviour: FormSuccessBehaviour;
  consentLine?: string;

  /** Trades + growth goals this form is designed for. */
  appliesTo: {
    trades: readonly string[];
    profileFlags?: readonly string[];
    growthGoals?: readonly string[];
  };

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenFormManifest = Readonly<FormManifest>;

/** Runtime renderer contract. Strategy-aware forms use this shape. */
export type FormRendererProps = {
  /** Resolved strategy from strategyResolver.resolve(). Forms call
   *  `.get(domain, field)` to read facets. Optional so plain forms
   *  can be rendered without a strategy present. */
  strategy?: {
    get(domain: string, field: string): unknown | undefined;
    inputs: {
      profile: { primaryServices: readonly string[]; secondaryServices?: readonly string[] };
      strategy: { pushServices: readonly string[] };
    };
  };
  /** Additional props passed to underlying UI primitives. */
  className?: string;
};

export type FormRenderer = ComponentType<
  FormRendererProps & { manifest: FrozenFormManifest }
>;
