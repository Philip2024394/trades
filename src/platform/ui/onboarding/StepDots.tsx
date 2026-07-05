// StepDots — multi-step progress indicator with morphing dots.
//
// Reference: shadcn.io wizard block. The active dot grows into a
// short pill; inactive dots stay circular. Optional labels row
// underneath.

export type StepDotsStep = {
  key: string;
  label?: string;
};

export type StepDotsProps = {
  steps: readonly StepDotsStep[];
  /** Zero-indexed active step. */
  activeIndex: number;
  /** Optional step click handler — enables jumping between steps. */
  onStepClick?: (index: number) => void;
  /** Colour tone. */
  tone?: "brand" | "neutral";
};

export function StepDots({
  steps,
  activeIndex,
  onStepClick,
  tone = "brand"
}: StepDotsProps) {
  const activeCls = tone === "brand" ? "bg-amber-400" : "bg-neutral-900";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ol className="flex items-center gap-1.5">
        {steps.map((step, i) => {
          const active = i === activeIndex;
          const done = i < activeIndex;
          const cls = `h-1.5 rounded-full transition-all duration-300 ease-out ${
            active
              ? `w-6 ${activeCls}`
              : done
              ? "w-1.5 bg-neutral-800"
              : "w-1.5 bg-neutral-300"
          } ${onStepClick ? "cursor-pointer" : ""}`;
          if (onStepClick) {
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => onStepClick(i)}
                  aria-label={step.label ?? `Step ${i + 1}`}
                  aria-current={active ? "step" : undefined}
                  className={cls}
                />
              </li>
            );
          }
          return (
            <li
              key={step.key}
              aria-current={active ? "step" : undefined}
              className={cls}
            />
          );
        })}
      </ol>
      {steps[activeIndex]?.label ? (
        <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Step {activeIndex + 1} of {steps.length} · {steps[activeIndex].label}
        </div>
      ) : null}
    </div>
  );
}
