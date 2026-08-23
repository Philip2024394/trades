// /food/register · public "Add My Business" registration page.
//
// Layer 3 · owner-triggered entry path into the flywheel. Owner supplies
// business details + WhatsApp · claim code sent to WhatsApp · owner enters
// code inline · on verify the record enters the Commercial Universe at
// owner_verified trust layer.
//
// Standalone page (outside /nexapp) — owner can be sent this URL directly.
// Off-white palette matches /food customer-facing directory · warm/appetising
// per Food V1 doctrine · Bahasa Indonesia primary label language per
// Indonesia-first product frame.

import { FoodRegisterFlow } from "./FoodRegisterFlow";

export const metadata = {
  title: "Daftarkan Bisnis Anda · NEX Food",
  description: "Tambahkan restoran, kafe, atau warung Anda ke NEX Food Yogyakarta.",
};

export default function FoodRegisterPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#faf7f2",
      padding: "24px 16px 60px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: "#f97316",
          fontWeight: 700, marginBottom: 12,
        }}>NEX FOOD · YOGYAKARTA</div>

        <h1 style={{
          fontSize: 26, fontWeight: 700, margin: "0 0 8px",
          lineHeight: 1.2, color: "#1a1a1a",
        }}>
          Daftarkan bisnis makanan Anda
        </h1>
        <div style={{
          fontSize: 13.5, color: "#5a5a5a", lineHeight: 1.55, marginBottom: 24,
        }}>
          Tambahkan restoran, kafe, warung, atau layanan makanan Anda ke NEX.
          Pelanggan menemukan bisnis Anda, mengirim pertanyaan lewat WhatsApp,
          dan Anda tetap memegang kendali penuh atas informasi bisnis Anda.
        </div>

        <FoodRegisterFlow />

        <div style={{
          marginTop: 32, paddingTop: 20,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          fontSize: 12, color: "#7a7a7a", lineHeight: 1.55,
        }}>
          <strong style={{ color: "#4a4a4a" }}>Yang akan dilakukan NEX:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li>Membuat halaman bisnis Anda di direktori NEX Food.</li>
            <li>Mengirim kode verifikasi 6-digit ke WhatsApp Anda.</li>
            <li>Setelah diverifikasi, Anda dapat mengelola detail bisnis Anda.</li>
          </ul>
          <div style={{ marginTop: 12 }}>
            NEX tidak akan pernah mengirim pesan pemasaran ke nomor WhatsApp Anda
            tanpa persetujuan Anda.
          </div>
        </div>
      </div>
    </div>
  );
}
