// NEX Knowledge Inbox — central intake for every fact entering NEX.
//
// This page is NOT a document manager. It is the front door to the
// NEX Knowledge Factory (per the Record Constitution and the Golden
// Rule doctrine in memory). Philip's job is to dump raw material at
// speed; NEX's job is to classify, dedupe, extract, and convert into
// governed knowledge records.
//
// Architectural intent (documented for future connectors — do not
// refactor the shell without preserving this shape):
//   ┌─ Capture surfaces (one inbox, many mouths) ────────────────┐
//   │  · drag/drop file upload  (txt md pdf docx csv xlsx        │
//   │                             jpg png webp mp3 wav mp4 zip)  │
//   │  · Quick Dump textarea    (paste anything)                 │
//   │  · URL Import             (fetch + store for later)        │
//   │  · Voice Notes            (upload + transcribe)            │
//   │  · Image Analysis         (staircase style / materials /   │
//   │                             components / heritage / manuf.) │
//   │                                                            │
//   │  · Future connectors (same pipeline):                      │
//   │    Email · WhatsApp · OneDrive · Google Drive · Dropbox ·  │
//   │    GitHub · Website crawler · YouTube transcripts ·        │
//   │    Research feeds · Government publications · Standards    │
//   │    organisations · PDF libraries                           │
//   └────────────────────────────────────────────────────────────┘
//                            │
//                            ▼
//   ┌─ Inbox Queue ──────────────────────────────────────────────┐
//   │  Items land here as Waiting.                               │
//   │  "Process Inbox" runs the classifier → dedupe → extract →  │
//   │  update/create records → generate FAQs → build graph edges │
//   │  → assign confidence → flag uncertain → archive processed. │
//   └────────────────────────────────────────────────────────────┘
//                            │
//                            ▼
//   ┌─ Processing Report ────────────────────────────────────────┐
//   │  Items processed · Records created · Records updated ·     │
//   │  FAQs generated · Graph edges created · Duplicates merged  │
//   │  · Images analysed · Voice notes transcribed · Needs review│
//   └────────────────────────────────────────────────────────────┘
//
// Backend is intentionally stubbed at v1 — every capture surface
// resolves to in-memory queue state; the Process Inbox button drives
// a simulated pipeline that produces a realistic report. The API
// layer (POST /api/nex/knowledge-inbox/*) can be added later without
// changing the component contract.

import { KnowledgeInboxShell } from "@/components/nex-app/knowledge-inbox/KnowledgeInboxShell";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Knowledge Inbox · NEX",
  robots: { index: false },
};

export default function KnowledgeInboxPage() {
  return (
    <div className="nex-app-root">
      <KnowledgeInboxShell />
    </div>
  );
}
