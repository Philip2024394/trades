// Design component: containers.wizard
//
// Multi-step container with progress rail + step slots. Used by
// booking flows AND multi-step forms. Consumers pass ordered steps as
// children; the container renders the active step + progress indicator.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type WizardProps = {
  progressStyle: "dots" | "numbered" | "bar" | "labeled";
  currentStep: number;
  showBack: boolean;
  align: "left" | "center";
};

type WizardContent = { childrenSlots?: string[] };

function WizardRenderer({
  props,
  children
}: {
  props: WizardProps;
  content: WizardContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const items = children ? [children].flat() : [];
  const total = items.length;
  const current = Math.max(0, Math.min(total - 1, props.currentStep));
  const activeStep = items[current];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing.lg,
        width: "100%",
        alignItems: props.align === "center" ? "center" : "stretch"
      }}
    >
      {/* Progress rail */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        style={{
          display: "flex",
          gap: theme.spacing.xs,
          alignItems: "center",
          width: "100%",
          maxWidth: 720
        }}
      >
        {props.progressStyle === "bar" ? (
          <div
            style={{
              height: 6,
              flex: 1,
              background: theme.color.subtle,
              borderRadius: theme.radius.full,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: `${((current + 1) / total) * 100}%`,
                height: "100%",
                background: theme.color.primary,
                transition: "width 220ms ease"
              }}
            />
          </div>
        ) : (
          Array.from({ length: total }).map((_, i) => {
            const done = i < current;
            const active = i === current;
            const label =
              props.progressStyle === "numbered" || props.progressStyle === "labeled"
                ? String(i + 1)
                : "";
            return (
              <div
                key={i}
                style={{
                  width: props.progressStyle === "dots" ? 10 : 28,
                  height: props.progressStyle === "dots" ? 10 : 28,
                  borderRadius: theme.radius.full,
                  background:
                    done || active
                      ? theme.color.primary
                      : theme.color.subtle,
                  color:
                    done || active
                      ? theme.color.primaryInk
                      : theme.color.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: theme.font.weightBold ?? 700
                }}
              >
                {props.progressStyle !== "dots" ? label : null}
              </div>
            );
          })
        )}
      </div>

      {/* Active step slot */}
      <div style={{ width: "100%" }}>{activeStep}</div>

      {/* Optional back-hint — actual navigation is caller-driven. */}
      {props.showBack && current > 0 && (
        <div
          style={{
            fontSize: 12,
            color: theme.color.muted,
            textAlign: props.align === "center" ? "center" : "left"
          }}
        >
          Step {current + 1} of {total} · use ‘Back’ to return to previous step.
        </div>
      )}
    </div>
  );
}

designSystemRegistry.register<WizardProps, WizardContent>({
  id: "containers.wizard",
  name: "Wizard",
  category: "containers",
  tier: "content",
  description:
    "Multi-step container with progress rail + step slots. Used by booking flows, multi-step forms, onboarding, and quote-request wizards.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "progressStyle",
      label: "Progress style",
      type: {
        kind: "select",
        options: [
          { value: "dots", label: "Dots" },
          { value: "numbered", label: "Numbered" },
          { value: "labeled", label: "Labeled" },
          { value: "bar", label: "Progress bar" }
        ]
      },
      default: "numbered"
    },
    {
      key: "currentStep",
      label: "Current step (0-indexed)",
      type: { kind: "number", min: 0, max: 20, step: 1 },
      default: 0
    },
    {
      key: "showBack",
      label: "Show back hint",
      type: { kind: "boolean" },
      default: true
    },
    {
      key: "align",
      label: "Alignment",
      type: {
        kind: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" }
        ]
      },
      default: "center"
    }
  ],
  themeTokensUsed: [
    "spacing.xs",
    "spacing.lg",
    "color.primary",
    "color.primaryInk",
    "color.subtle",
    "color.muted",
    "radius.full"
  ],
  animations: ["none", "slide", "fade-in"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "wizard",
    "steps",
    "multi-step",
    "onboarding",
    "booking",
    "quote",
    "progress"
  ],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  compatibleThemes: ["*"],
  defaultProps: () => ({
    progressStyle: "numbered",
    currentStep: 0,
    showBack: true,
    align: "center"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: WizardRenderer
});
