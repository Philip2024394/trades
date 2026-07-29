// /nex-app/materials/add — Add Stock with NEX (vertical slice · Philip 2026-07-28).
//
// Owner types "Add 20 oak flooring boards" or drops a delivery note.
// NEX parses, resolves against Materials Memory, presents a confirmation
// screen · the owner approves · the existing pack + board services do
// the writes.

import { AddStockWorkflow } from "@/components/nex-app/materials/add-stock/AddStockWorkflow";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Stock · NEX Materials", robots: { index: false } };

export default function AddStockPage() {
  return (
    <div className="nex-app-root">
      <AddStockWorkflow />
    </div>
  );
}
