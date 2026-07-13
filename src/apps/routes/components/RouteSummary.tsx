// Route summary — top-of-page metrics + delivery vs pickup split.
// Shows miles saved vs a naive order, estimated time, and money saved
// in diesel.

import { Route as RouteIcon, Truck, ShoppingBag, Clock, Sparkles } from "lucide-react";
import type { JobRoute } from "../data/routes";

type Props = {
  route: JobRoute;
};

const DIESEL_PPL = 1.55;
const MPG_LADEN_VAN = 30;
const DIESEL_COST_PER_MILE = (DIESEL_PPL * 4.546) / MPG_LADEN_VAN; // £ per mile

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function RouteSummary({ route }: Props) {
  const dieselSavedGbp = route.milesSavedVsNaive * DIESEL_COST_PER_MILE;
  const pickupCount = route.stops.length;
  const deliveryCount = route.deliveryStops.length;

  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: "rgba(139,69,19,0.15)",
        backgroundColor: "#0A0A0A"
      }}
    >
      <div className="flex items-center gap-2" style={{ color: "#FFB300" }}>
        <RouteIcon size={14}/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em]">
          Route Optimiser · R02
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <Stat
          Icon={ShoppingBag}
          headline={pickupCount.toString()}
          caption={pickupCount === 1 ? "Pickup" : "Pickups"}
        />
        <Stat
          Icon={Truck}
          headline={deliveryCount.toString()}
          caption={deliveryCount === 1 ? "Delivery" : "Deliveries"}
        />
        <Stat
          Icon={RouteIcon}
          headline={`${route.totalPickupMiles} mi`}
          caption="Total pickup drive"
        />
        <Stat
          Icon={Clock}
          headline={formatMinutes(route.estimatedTotalMinutes)}
          caption="Estimated time"
        />
      </div>

      {/* Savings callout */}
      {route.milesSavedVsNaive > 0 && (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
          style={{ backgroundColor: "rgba(255,179,0,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "#FFB300" }}/>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#FFB300" }}>
                Savings vs naive route
              </div>
              <div className="mt-0.5 text-[15px] font-black text-white">
                {route.milesSavedVsNaive.toLocaleString()} miles saved · ~£{dieselSavedGbp.toFixed(0)} diesel
              </div>
            </div>
          </div>
          <div className="text-[10.5px] text-white/70">
            Recommending delivery on far-away merchants instead of driving to them.
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  Icon,
  headline,
  caption
}: {
  Icon: typeof RouteIcon;
  headline: string;
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "rgba(255,179,0,0.7)" }}>
        <Icon size={11}/>
        {caption}
      </div>
      <div className="mt-0.5 text-[20px] font-black text-white">{headline}</div>
    </div>
  );
}
