// Key Features (left column) + Specs Table (right column) — two-up section
// that sits below the fold on the PDP.

import { Check } from "lucide-react";
import type { ProductFeature, ProductSpec } from "../../data/productDetails";

type Props = {
  features: ProductFeature[];
  specs: ProductSpec[];
};

export function KeyFeaturesAndSpecs({ features, specs }: Props) {
  if (features.length === 0 && specs.length === 0) return null;

  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-2">
          {features.length > 0 && (
            <div>
              <h2 className="text-[16px] font-black text-neutral-900">Key features</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "#166534" }}
                    >
                      <Check size={11} className="text-white" strokeWidth={3}/>
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-black text-neutral-900">{f.label}</div>
                      {f.detail && (
                        <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">{f.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {specs.length > 0 && (
            <div>
              <h2 className="text-[16px] font-black text-neutral-900">Specifications</h2>
              <dl
                className="mt-3 divide-y overflow-hidden rounded-lg border bg-white"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                {specs.map((s, i) => (
                  <div key={i} className="grid grid-cols-[130px_1fr] gap-3 px-3 py-2">
                    <dt className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                      {s.label}
                    </dt>
                    <dd className="text-[12px] font-bold text-neutral-800">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
