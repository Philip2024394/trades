// Admin firehose — every AI Visualiser lead across every merchant.

"use client";

type AdminLead = {
  id: string;
  full_name: string;
  email: string;
  whatsapp_e164: string;
  home_phone: string | null;
  postcode: string;
  first_leaf_slug: string | null;
  render_count: number;
  source: string;
  merchant_id: string;
  created_at: string;
};

export function AdminLeadsTable({ leads }: { leads: AdminLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-[13px] text-neutral-500">
        No leads yet. Registrations will show up here as they come in.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-neutral-50 text-left text-[13px] text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-semibold">When</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">WhatsApp</th>
              <th className="px-3 py-2 font-semibold">Phone</th>
              <th className="px-3 py-2 font-semibold">Postcode</th>
              <th className="px-3 py-2 font-semibold">Leaf</th>
              <th className="px-3 py-2 font-semibold">Renders</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold">Merchant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-neutral-500">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-semibold text-neutral-900">
                  {l.full_name}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`mailto:${l.email}`}
                    className="text-neutral-800 underline-offset-2 hover:underline"
                  >
                    {l.email}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://wa.me/${l.whatsapp_e164.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline-offset-2 hover:underline"
                  >
                    {l.whatsapp_e164}
                  </a>
                </td>
                <td className="px-3 py-2 text-neutral-700">
                  {l.home_phone || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-neutral-800">
                  {l.postcode}
                </td>
                <td className="px-3 py-2 text-neutral-700">
                  {l.first_leaf_slug || "—"}
                </td>
                <td className="px-3 py-2 text-neutral-700">{l.render_count}</td>
                <td className="px-3 py-2 text-neutral-500">{l.source}</td>
                <td className="px-3 py-2 font-mono text-[13px] text-neutral-500">
                  {l.merchant_id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
