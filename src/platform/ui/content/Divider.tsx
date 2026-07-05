// Divider — three variants: line / hairline / dotted.
//
// Consistent look for section-internal separators. For section-to-
// section separation, prefer changing SectionContainer surface.

export type DividerVariant = "line" | "hairline" | "dotted";
export type DividerSpacing = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<DividerVariant, string> = {
  line: "border-t border-neutral-200",
  hairline: "border-t border-neutral-100",
  dotted: "border-t border-dashed border-neutral-300"
};

const SPACING_CLASS: Record<DividerSpacing, string> = {
  sm: "my-3",
  md: "my-4 md:my-6",
  lg: "my-6 md:my-10"
};

export type DividerProps = {
  variant?: DividerVariant;
  spacing?: DividerSpacing;
  /** Optional inline label — renders as "hr with text". */
  label?: string;
};

export function Divider({
  variant = "line",
  spacing = "md",
  label
}: DividerProps) {
  if (label) {
    return (
      <div className={`relative flex items-center ${SPACING_CLASS[spacing]}`}>
        <div className={`flex-1 ${VARIANT_CLASS[variant]}`} />
        <span className="px-3 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        <div className={`flex-1 ${VARIANT_CLASS[variant]}`} />
      </div>
    );
  }
  return (
    <div className={`${VARIANT_CLASS[variant]} ${SPACING_CLASS[spacing]}`.trim()} />
  );
}
