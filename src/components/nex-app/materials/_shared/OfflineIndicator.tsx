// OfflineIndicator — thin bar that appears when the browser reports
// offline. Silent when online.

"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateOnline = () => setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    updateOnline();
    window.addEventListener("online",  updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online",  updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-[11.5px] font-bold text-white"
      style={{ background: "#B85A0C" }}
    >
      <CloudOff size={13} strokeWidth={2.25} />
      <span>Offline — actions will retry when reconnected</span>
    </div>
  );
}
