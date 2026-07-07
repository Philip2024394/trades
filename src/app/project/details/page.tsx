// Step 2 — Scope + Timeframe + Budget.
"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useDraft, TIMEFRAMES, BUDGETS } from "../draftStore";
import { WizardShell, fieldClass, labelClass } from "../WizardShell";

export default function StepDetails() {
  const router = useRouter();
  const { draft, patch, hydrated } = useDraft();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    patch({
      scope: String(f.get("scope") ?? "").trim(),
      timeframe: String(f.get("timeframe") ?? ""),
      budget: String(f.get("budget") ?? "")
    });
    router.push("/project/contact");
  }

  return (
    <WizardShell
      step="details"
      backHref="/project/start"
      title="What&apos;s the scope?"
      subtitle="A short brief, when you want it done, and a budget range. Rough is fine."
    >
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="scope" className={labelClass}>
            What do you want done?
          </label>
          <textarea
            id="scope"
            name="scope"
            required
            defaultValue={hydrated ? draft.scope : ""}
            placeholder="e.g. Full kitchen renovation, remove existing units, tile splashback, install new appliances. Prefer a Mon–Fri trade."
            rows={5}
            className={`${fieldClass} mt-2 resize-y`}
            minLength={10}
            maxLength={2000}
          />
          <p className="mt-1 text-[13px] text-[#1B1A17]/45">
            The clearer the brief, the better the match.
          </p>
        </div>

        <div>
          <label htmlFor="timeframe" className={labelClass}>
            When do you want it done?
          </label>
          <select
            id="timeframe"
            name="timeframe"
            required
            defaultValue={hydrated ? draft.timeframe : ""}
            className={`${fieldClass} mt-2 appearance-none`}
          >
            <option value="" disabled className="text-black">
              Choose one…
            </option>
            {TIMEFRAMES.map((t) => (
              <option key={t.value} value={t.value} className="text-black">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="budget" className={labelClass}>
            Rough budget
          </label>
          <select
            id="budget"
            name="budget"
            required
            defaultValue={hydrated ? draft.budget : ""}
            className={`${fieldClass} mt-2 appearance-none`}
          >
            <option value="" disabled className="text-black">
              Choose one…
            </option>
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value} className="text-black">
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300 sm:w-auto"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
