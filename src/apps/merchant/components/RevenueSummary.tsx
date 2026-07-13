// Merchant dashboard headline metrics — revenue + funds held + orders +
// followers. Big numbers at the top so the merchant sees state at a
// glance.

import { TrendingUp, Wallet, ShoppingBag, Users, MessageSquare, Package } from "lucide-react";
import type { MerchantStats } from "../lib/merchantStats";

type Props = {
  stats: MerchantStats;
};

function formatGbp(v: number): string {
  return v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`;
}

export function RevenueSummary({ stats }: Props) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: "rgba(139,69,19,0.15)",
        backgroundColor: "#0A0A0A"
      }}
    >
      <div className="flex items-center gap-2" style={{ color: "#FFB300" }}>
        <TrendingUp size={14}/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em]">
          Merchant dashboard — 30-day view
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <BigStat Icon={TrendingUp} label="Revenue"
                 value={formatGbp(stats.revenue30dGbp)}
                 subtitle={`${stats.revenue30dOrderCount} orders`}/>
        <BigStat Icon={Wallet} label="Funds held"
                 value={formatGbp(stats.fundsHeldGbp)}
                 subtitle={`${stats.fundsHeldOrderCount} escrows`}/>
        <BigStat Icon={ShoppingBag} label="Actions needed"
                 value={stats.outstandingActionCount.toString()}
                 subtitle="orders / disputes"/>
        <BigStat Icon={MessageSquare} label="Unread messages"
                 value={stats.unreadMessagesCount.toString()}
                 subtitle="threads"/>
        <BigStat Icon={Package} label="Products live"
                 value={stats.productsListed.toString()}
                 subtitle="in catalogue"/>
        <BigStat Icon={Users} label="Followers"
                 value={stats.followerCount.toLocaleString()}
                 subtitle={`${stats.productsInNotebooks} Notebook adds`}/>
      </div>

      {/* 12-week revenue sparkline */}
      <div className="mt-5 rounded-lg p-3" style={{ backgroundColor: "rgba(255,179,0,0.10)" }}>
        <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#FFB300" }}>
          Revenue — last 12 weeks
        </div>
        <div className="mt-2 flex h-16 items-end gap-1">
          {stats.weeklyRevenueSeriesGbp.map((v, i) => {
            const max = Math.max(...stats.weeklyRevenueSeriesGbp, 1);
            const pct = (v / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${pct}%`,
                  backgroundColor: i === stats.weeklyRevenueSeriesGbp.length - 1 ? "#FFB300" : "rgba(255,179,0,0.55)"
                }}
                title={`Week ${i + 1}: £${v}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BigStat({
  Icon,
  label,
  value,
  subtitle
}: {
  Icon: typeof TrendingUp;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider" style={{ color: "rgba(255,179,0,0.7)" }}>
        <Icon size={10}/>
        {label}
      </div>
      <div className="mt-0.5 text-[20px] font-black text-white">{value}</div>
      <div className="text-[9.5px] text-white/60">{subtitle}</div>
    </div>
  );
}
