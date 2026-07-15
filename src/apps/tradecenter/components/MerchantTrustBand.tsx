// Merchant bottom trust band — 4 icon columns per mock.
// Standard "we won't screw you over" reassurance strip.

import { Truck, ShieldCheck, LifeBuoy, RotateCcw } from "lucide-react";

type Column = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

const COLUMNS: readonly Column[] = [
  {
    icon: <Truck size={18} strokeWidth={2}/>,
    title: "Fast Delivery",
    body: "Order before 2pm for same day dispatch"
  },
  {
    icon: <ShieldCheck size={18} strokeWidth={2}/>,
    title: "Quality Guarantee",
    body: "All products are 100% quality checked"
  },
  {
    icon: <LifeBuoy size={18} strokeWidth={2}/>,
    title: "Expert Support",
    body: "Need help? We're here to help"
  },
  {
    icon: <RotateCcw size={18} strokeWidth={2}/>,
    title: "30 Day Returns",
    body: "Hassle free returns on all orders"
  }
];

export function MerchantTrustBand() {
  return (
    <section
      className="mt-6 grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {COLUMNS.map((c) => (
        <div key={c.title} className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FBF6EC", color: "#0A0A0A" }}
            aria-hidden
          >
            {c.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-black uppercase tracking-wider text-neutral-800">
              {c.title}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              {c.body}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
