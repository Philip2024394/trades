// Step 3 — Contact info. No account required.
"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useDraft, type ProjectDraft } from "../draftStore";
import { WizardShell, fieldClass, labelClass } from "../WizardShell";

const PREFS: Array<{ value: ProjectDraft["contactPref"]; label: string }> = [
  { value: "any", label: "Any of the above" },
  { value: "email", label: "Email only" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp only" }
];

export default function StepContact() {
  const router = useRouter();
  const { draft, patch, hydrated } = useDraft();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    patch({
      name: String(f.get("name") ?? "").trim(),
      email: String(f.get("email") ?? "").trim().toLowerCase(),
      whatsapp: String(f.get("whatsapp") ?? "").trim(),
      contactPref: (String(
        f.get("contactPref") ?? "any"
      ) as ProjectDraft["contactPref"])
    });
    router.push("/project/matches");
  }

  return (
    <WizardShell
      step="contact"
      backHref="/project/details"
      title="How should trades reach you?"
      subtitle="No account needed. We&apos;ll only share your details with the trades you pick in the next step."
    >
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="name" className={labelClass}>
            Your name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={hydrated ? draft.name : ""}
            placeholder="First name only is fine"
            className={`${fieldClass} mt-2`}
            autoComplete="name"
            maxLength={80}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={hydrated ? draft.email : ""}
            placeholder="you@example.com"
            className={`${fieldClass} mt-2`}
            autoComplete="email"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp (optional)
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            defaultValue={hydrated ? draft.whatsapp : ""}
            placeholder="+44 7…"
            className={`${fieldClass} mt-2`}
            autoComplete="tel"
            maxLength={30}
          />
        </div>

        <div>
          <span className={labelClass}>How would you prefer to be contacted?</span>
          <div className="mt-3 space-y-2">
            {PREFS.map((p) => (
              <label
                key={p.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 px-4 py-3 hover:border-[#1B1A17]/18"
              >
                <input
                  type="radio"
                  name="contactPref"
                  value={p.value}
                  defaultChecked={
                    hydrated ? draft.contactPref === p.value : p.value === "any"
                  }
                  className="h-4 w-4 accent-amber-400"
                />
                <span className="text-[14px] text-[#1B1A17]">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300 sm:w-auto"
          >
            See matches
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <p className="mt-3 text-[13px] text-[#1B1A17]/45">
            We never publish your contact details. They only go to the
            trades you pick.
          </p>
        </div>
      </form>
    </WizardShell>
  );
}
