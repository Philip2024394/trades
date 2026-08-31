"use client";
// NEX Network capability · Philip 2026-08-30 · Slice 3 · Capability Surface
//
// Surfaces the 7 Network destinations as ROUND BUTTONS inside the NEX shell.
// Same Registry + Renderer pattern as Tools (Slice 1). Honest per Rule 5:
// most items are pending real inline surfaces; each button shows its true
// status. No standalone-page ejection · shell chrome remains present.

import React from "react";
import {
  Users,
  Building2,
  Store,
  MessageCircle,
  Gift,
  DollarSign,
  Activity as ActivityIcon,
} from "lucide-react";
import { capabilityRegistry, type CapabilityViewProps } from "./capabilities";
import { CapabilityHeader } from "@/components/nexapp/CapabilityHeader";

interface NetworkItem {
  id: string;
  label: string;
  status: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}

const ITEMS: NetworkItem[] = [
  { id: "people",       label: "People",           status: "Pending",                       blurb: "Follows, saved contacts, network graph.",                  icon: Users },
  { id: "businesses",   label: "Businesses",       status: "Live under Discover",           blurb: "Directory of trades and merchants across the network.",   icon: Building2 },
  { id: "marketplace",  label: "Marketplace",      status: "Live under Discover",           blurb: "Trade Centre buying + selling.",                            icon: Store },
  { id: "community",    label: "Community",        status: "Live under Discover",           blurb: "Yard posts, canteens, community threads.",                  icon: MessageCircle },
  { id: "referrals",    label: "Referrals",        status: "Live · pending consumer view",  blurb: "Merchant-to-merchant referral rewards.",                    icon: Gift },
  { id: "affiliates",   label: "Affiliates",       status: "Live in admin",                 blurb: "Cash affiliate program.",                                    icon: DollarSign },
  { id: "activity",     label: "Network activity", status: "Pending",                       blurb: "Cross-network events, new members, mutual introductions.",  icon: ActivityIcon },
];

function NetworkEntryView(_props: CapabilityViewProps) {
  return (
    <>
      <CapabilityHeader eyebrow="Network" title="People, businesses, community" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
          padding: "0 20px 20px",
          justifyItems: "center",
        }}
      >
        {ITEMS.map(({ id, label, status, blurb, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={`${label} · ${status}`}
            title={blurb}
            disabled
            style={{
              appearance: "none",
              width: "100%",
              maxWidth: 92,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(74,201,255,0.28)",
              color: "rgba(245,245,245,0.9)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 6,
              fontFamily: "inherit",
              cursor: "not-allowed",
              boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            <Icon size={22} strokeWidth={1.8} color="rgba(74,201,255,0.92)" />
            <span
              style={{
                fontSize: 10,
                letterSpacing: 0.3,
                textAlign: "center",
                lineHeight: 1.15,
                padding: "0 2px",
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          margin: "8px 20px 40px",
          padding: 16,
          borderRadius: 12,
          background: "rgba(74,201,255,0.06)",
          border: "1px solid rgba(74,201,255,0.22)",
          fontSize: 12,
          color: "rgba(245,245,245,0.7)",
          lineHeight: 1.55,
        }}
      >
        The Network destination is where the NEX ecosystem &mdash; the people, the
        businesses you connect with, referrals, affiliates and community threads
        &mdash; come together. Some pieces already run today under other rooms;
        they are being re-surfaced here in later batches.
      </div>
    </>
  );
}

capabilityRegistry.register({
  id: "network",
  label: "Network",
  entryView: "entry",
  views: { entry: NetworkEntryView },
  wants: {
    composer: false,
    orb: "default",
    railAccent: "#4ac9ff",
  },
});
