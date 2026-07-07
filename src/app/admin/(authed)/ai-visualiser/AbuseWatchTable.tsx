// Cross-merchant abuse watch. Same identity (WhatsApp / fingerprint)
// appearing on 3+ merchants is a strong farming signal.

"use client";

import { AlertTriangle } from "lucide-react";
import type { CrossMerchantIdentity } from "@/lib/ai-visualiser/abuseDetection";

export function AbuseWatchTable({
  identities
}: {
  identities: CrossMerchantIdentity[];
}) {
  if (identities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-[13px] text-neutral-500">
        No cross-merchant patterns detected in the last 30 days.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50">
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100 px-3 py-2 text-[13px] font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {identities.length} identity{identities.length === 1 ? "" : "ies"} flagged
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-amber-50 text-left text-[13px] text-amber-900">
            <tr>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Identity</th>
              <th className="px-3 py-2 font-semibold">Merchants</th>
              <th className="px-3 py-2 font-semibold">First seen</th>
              <th className="px-3 py-2 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 bg-white">
            {identities.map((id) => (
              <tr key={`${id.identityType}:${id.identityValue}`}>
                <td className="px-3 py-2 text-neutral-700">
                  {id.identityType}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] text-neutral-800">
                  {id.identityValue.slice(0, 16)}…
                </td>
                <td className="px-3 py-2 font-bold text-red-700">
                  {id.merchantCount}
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {new Date(id.firstSeenAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {new Date(id.lastSeenAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
