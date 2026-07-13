// CountdownTimer — live-updating "time remaining" pill.
//
// Used on Trade Clearance offers and Trade Counter cards so every user
// sees the same expiring-soon urgency. Ticks once per second down to
// hours, then once per minute for the rest.

"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

type Props = {
  expiresAtIso: string;
  className?: string;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  if (mins >= 1) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function CountdownTimer({ expiresAtIso, className }: Props) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAtIso).getTime() - Date.now());

  useEffect(() => {
    const target = new Date(expiresAtIso).getTime();
    function tick() {
      setRemaining(target - Date.now());
    }
    tick();
    // 1s cadence when < 1h left, 30s otherwise
    const interval = setInterval(tick, remaining < 60 * 60_000 ? 1000 : 30_000);
    return () => clearInterval(interval);
  }, [expiresAtIso, remaining]);

  const expired = remaining <= 0;
  const critical = remaining > 0 && remaining < 24 * 60 * 60_000; // < 24h

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${className ?? ""}`}
      style={{
        backgroundColor: expired ? "#B91C1C" : critical ? "#F59E0B" : "#0A0A0A",
        color:           expired ? "#FFFFFF" : critical ? "#0A0A0A" : "#FFB300"
      }}
      title={expired ? "Offer expired — needs reposting" : `Expires at ${new Date(expiresAtIso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}
    >
      {expired ? <AlertTriangle size={9}/> : <Clock size={9}/>}
      {formatRemaining(remaining)}
    </span>
  );
}
