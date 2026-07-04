"use client";

// ButtonSlot — the primitive every section renderer uses to embed a
// registered button.
//
// Resolves in priority order:
//   1. Explicit `variantKey` — use exactly that variant
//   2. Global button bound to this brand for the given role — inherit
//      the merchant's cross-page defaults
//   3. Fallback variant (declared by the caller for its category)
//
// Also merges the section's runtime context into MerchantData.domain
// so payment buttons pick up amount / currency / orderRef / etc.
// without the section having to know a payment button is rendering.

import { useMemo } from "react";
import { buttonRegistry } from "./buttonRegistry";
import "./index"; // side-effect: register every variant
import type {
  BrandTokens,
  MerchantData,
  SectionRenderMode
} from "@/lib/studio/sectionTypes";
import type {
  ButtonRole,
  ButtonState,
  FrozenButtonRegistration
} from "./types";

// ─── Public shape ──────────────────────────────────

export type PaymentContext = {
  brandId?: string;
  amountMinor?: number;
  currency?: string;
  orderRef?: string;
  description?: string;
  customerEmail?: string;
  returnUrl?: string;
  cancelUrl?: string;
};

export type GlobalButtonMap = Partial<Record<string, string>>; // role → variantKey

export type ButtonSlotProps = {
  /** Merchant intent — resolved to the brand's Global if bound. */
  role: ButtonRole | string;
  /** Explicit variant override — beats Global. */
  variantKey?: string;
  /** Fallback variant if neither variantKey nor Global resolves.
   *  Renderers should pick a safe default matching their category. */
  fallbackVariantKey: string;
  /** Optional per-instance config override — merges over the
   *  variant's `defaultConfig()`. Sections pass label + href here. */
  configOverride?: Record<string, unknown>;
  /** Runtime state — usually "default"; can be driven by useButtonState
   *  by the caller if they need loading/success stitching. */
  state?: ButtonState;
  /** Brand token map — same shape sections receive. */
  tokens: BrandTokens;
  /** Merchant data — payment context merges into `data.domain`. */
  data: MerchantData;
  /** Studio render mode — sections pass their own mode through. */
  mode: SectionRenderMode;
  /** Brand's Global button map — pass through from section data if the
   *  caller wants Global resolution. */
  globals?: GlobalButtonMap;
  /** Runtime payment context — injected into `data.domain.paymentContext`
   *  so payment button variants pick it up. */
  paymentContext?: PaymentContext;
};

export function ButtonSlot(props: ButtonSlotProps) {
  const resolved = useMemo<FrozenButtonRegistration | undefined>(() => {
    if (props.variantKey) {
      const r = buttonRegistry.get(props.variantKey);
      if (r) return r;
    }
    if (props.globals && props.role in props.globals) {
      const globalKey = props.globals[props.role];
      if (globalKey) {
        const r = buttonRegistry.get(globalKey);
        if (r) return r;
      }
    }
    return buttonRegistry.get(props.fallbackVariantKey);
  }, [props.variantKey, props.role, props.globals, props.fallbackVariantKey]);

  const config = useMemo(() => {
    if (!resolved) return {};
    const base = resolved.defaultConfig() as Record<string, unknown>;
    return { ...base, ...(props.configOverride ?? {}) };
  }, [resolved, props.configOverride]);

  const enrichedData = useMemo<MerchantData>(() => {
    if (!props.paymentContext) return props.data;
    return {
      ...props.data,
      domain: {
        ...(props.data.domain ?? {}),
        paymentContext: props.paymentContext
      }
    };
  }, [props.data, props.paymentContext]);

  if (!resolved) {
    if (props.mode === "edit") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: "#DC2626",
            background: "rgba(220,38,38,0.08)",
            border: "1px dashed #DC2626",
            borderRadius: 8
          }}
        >
          Button variant not found:{" "}
          <code>{props.variantKey ?? props.fallbackVariantKey}</code>
        </span>
      );
    }
    return null;
  }

  const Renderer = resolved.renderer;
  return (
    <Renderer
      instanceId={`slot-${resolved.id}`}
      config={config}
      state={props.state ?? "default"}
      tokens={props.tokens}
      role={resolved.role}
      size={resolved.size}
      shape={resolved.shape}
      motion={resolved.motion}
      data={enrichedData}
      mode={props.mode}
    />
  );
}
