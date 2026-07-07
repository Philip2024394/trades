// Step 1 — Property + Project type + Postcode.
"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  useDraft,
  PROPERTY_TYPES,
  PROJECT_TYPES
} from "../draftStore";
import { WizardShell, fieldClass, labelClass } from "../WizardShell";

export default function StepStart() {
  const router = useRouter();
  const { draft, patch, hydrated } = useDraft();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    patch({
      postcode: String(f.get("postcode") ?? "").trim().toUpperCase(),
      propertyType: String(f.get("propertyType") ?? ""),
      projectType: String(f.get("projectType") ?? "")
    });
    router.push("/project/details");
  }

  return (
    <WizardShell
      step="start"
      backHref="/"
      title="Tell us where and what."
      subtitle="Postcode, property, and the kind of work you want doing. All the specifics come next."
    >
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="postcode" className={labelClass}>
            Postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            required
            defaultValue={hydrated ? draft.postcode : ""}
            placeholder="e.g. M1 2AB"
            className={`${fieldClass} mt-2 uppercase`}
            autoComplete="postal-code"
            maxLength={8}
          />
        </div>

        <div>
          <label htmlFor="propertyType" className={labelClass}>
            Property type
          </label>
          <select
            id="propertyType"
            name="propertyType"
            required
            defaultValue={hydrated ? draft.propertyType : ""}
            className={`${fieldClass} mt-2 appearance-none`}
          >
            <option value="" disabled className="text-black">
              Choose one…
            </option>
            {PROPERTY_TYPES.map((p) => (
              <option key={p.value} value={p.value} className="text-black">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="projectType" className={labelClass}>
            What kind of project?
          </label>
          <select
            id="projectType"
            name="projectType"
            required
            defaultValue={hydrated ? draft.projectType : ""}
            className={`${fieldClass} mt-2 appearance-none`}
          >
            <option value="" disabled className="text-black">
              Choose one…
            </option>
            {PROJECT_TYPES.map((p) => (
              <option key={p.value} value={p.value} className="text-black">
                {p.label}
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
