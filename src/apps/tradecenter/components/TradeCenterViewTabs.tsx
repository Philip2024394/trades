"use client";

// TradeCenterViewTabs — thin tab strip that sits above the Trade
// Center body. Two views:
//   • Catalogue → the current product grid (default)
//   • Live      → The Counter feed (cross-canteen live listings)
//
// URL-driven so tab state is shareable + back-button friendly. Powered
// by ?view=live query param. Tabs use the same gray-inactive /
// green-active convention as the /counter filter pills so the visual
// language stays consistent across the platform.

import { useRouter, useSearchParams } from "next/navigation";
import { Rocket, Grid3x3 } from "lucide-react";

const GREEN = "#166534";
const GRAY_BG = "#E5E7EB";
const GRAY_FG = "#4B5563";

type View = "catalogue" | "live";

export function TradeCenterViewTabs() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const activeParam  = searchParams?.get("view");
  const view: View   = activeParam === "live" ? "live" : "catalogue";

  function goTo(next: View) {
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "live") q.set("view", "live"); else q.delete("view");
    const qs = q.toString();
    router.push(qs ? `/tc/trade-center?${qs}` : `/tc/trade-center`, { scroll: false });
  }

  return (
    <div className="border-b bg-[#FBF6EC]" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 md:px-6">
        <TabButton
          label="Catalogue"
          icon={<Grid3x3 size={12} strokeWidth={2.6}/>}
          active={view === "catalogue"}
          onClick={() => goTo("catalogue")}
        />
        <TabButton
          label="Live · The Counter"
          icon={<Rocket size={12} strokeWidth={2.6}/>}
          active={view === "live"}
          onClick={() => goTo("live")}
          pulse
        />
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
  pulse
}: {
  label:   string;
  icon:    React.ReactNode;
  active:  boolean;
  onClick: () => void;
  pulse?:  boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="relative inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: GREEN,   color: "#FFFFFF", borderColor: "transparent" }
          : { backgroundColor: GRAY_BG, color: GRAY_FG,   borderColor: "transparent" }
      }
    >
      {icon}
      {label}
      {pulse && !active && (
        <span
          aria-hidden
          className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "#FFB300" }}
        />
      )}
    </button>
  );
}
