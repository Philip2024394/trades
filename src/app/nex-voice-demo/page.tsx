// NEX Voice · prototype demo page.
//
// PROTOTYPE ONLY. Not a production surface. Not linked from anywhere.
// Reachable at /nex-voice-demo (dev server on :3008).
//
// Purpose: prove the full loop
//   SPEAK → TRANSCRIBE → /api/nex-conv/chat → NEX brain → REPLY → SPEAK
// at £0 with zero changes to the existing brain / state / quotation code.
//
// If this page is ever wrapped into a customer-facing surface, the
// browser Web Speech API must first be replaced with a privacy-controlled
// STT provider (Groq Whisper Turbo / local whisper.cpp) behind the same
// NexVoiceProvider interface. That swap is one new adapter file · zero
// changes to this page or to VoiceMic.

import { VoiceMic } from "@/components/nex-voice/VoiceMic";

export const dynamic = "force-dynamic";

export default function NexVoiceDemoPage() {
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={badgeStyle}>PROTOTYPE ONLY</div>
        <h1 style={titleStyle}>NEX Voice — proof loop</h1>
        <p style={leadStyle}>
          Speak → NEX transcribes → NEX brain runs the same pipeline as the text chat →
          NEX responds → your browser speaks the reply.
        </p>
        <div style={warnStyle}>
          <strong>Privacy notice:</strong> your browser may send captured audio to a cloud speech
          service (Google) to transcribe it. <strong>Do not read out sensitive customer data.</strong>
          {" "}A privacy-controlled provider (Groq Whisper / local Whisper) will replace the browser
          engine before this touches any customer.
        </div>
      </header>
      <VoiceMic />
      <footer style={footerStyle}>
        <ul style={ulStyle}>
          <li>Uses the same <code>/api/nex-conv/chat</code> endpoint the text UI uses.</li>
          <li>No second brain. No second state. No pricing meter.</li>
          <li>Audio is not persisted (client or server).</li>
          <li>Quotation calculations remain deterministic — voice does not touch them.</li>
        </ul>
      </footer>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#faf9f5",
  padding: "40px 20px 60px",
};

const headerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto 24px",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#f59e0b",
  color: "#3a1e00",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  padding: "4px 10px",
  borderRadius: 999,
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: "0 0 6px",
  color: "#111",
};

const leadStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#444",
  margin: "0 0 16px",
  lineHeight: 1.5,
};

const warnStyle: React.CSSProperties = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 13,
  color: "#78350f",
  lineHeight: 1.5,
};

const footerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "24px auto 0",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  fontSize: 12,
  color: "#666",
};

const ulStyle: React.CSSProperties = {
  listStyle: "square",
  paddingLeft: 20,
  margin: 0,
  lineHeight: 1.6,
};
