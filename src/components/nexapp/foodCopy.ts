// NEX Food Directory · English + Indonesian copy · plain data module.
// Extracted per pinned RAM-aware doctrine (small compile units).

export type FoodCopy = {
  headerCityLabel: string;              // "FOOD · YOGYAKARTA"
  searchPlaceholder: string;
  emptyResultsTitle: string;
  emptyResultsHint: string;
  categoryAll: string;
  ratingReviews: (n: number) => string; // "240 reviews"
  openLabel: string;
  closedLabel: string;
  unknownStatusLabel: string;
  nexMemberBadge: string;               // shown on claimed cards
  invitedBadge: string;                 // shown on invited cards
  notYetClaimedBadge: string;           // shown on unclaimed cards
  businessBeingVerified: string;        // subtle sub-line for unclaimed
  backToList: string;
  aboutSection: string;
  menuSection: string;
  menuComingSoon: string;               // for claimed without dishes
  noMenuUnclaimed: string;              // for unclaimed
  unavailable: string;
  contactAction: string;
  inviteToNexAction: string;
  ownerClaimHint: string;               // "Are you the owner?"
};

export const FOOD_COPY_EN: FoodCopy = {
  headerCityLabel: "FOOD · YOGYAKARTA",
  searchPlaceholder: "coffee near Malioboro · cheap Indonesian food · open now…",
  emptyResultsTitle: "Nothing matches yet.",
  emptyResultsHint: "Try a broader search, or clear the category filter.",
  categoryAll: "All",
  ratingReviews: (n) => `${n.toLocaleString("en")} reviews`,
  openLabel: "Open",
  closedLabel: "Closed",
  unknownStatusLabel: "Hours unknown",
  nexMemberBadge: "NEX MEMBER",
  invitedBadge: "INVITED",
  notYetClaimedBadge: "LOCAL BUSINESS",
  businessBeingVerified: "Business information being verified",
  backToList: "Back",
  aboutSection: "About",
  menuSection: "Menu",
  menuComingSoon: "Menu coming soon",
  noMenuUnclaimed: "This restaurant hasn't joined NEX yet — the menu will appear when the owner claims and publishes it.",
  unavailable: "Unavailable",
  contactAction: "Contact",
  inviteToNexAction: "Invite this business to NEX",
  ownerClaimHint: "Are you the owner? Claim this listing.",
};

export const FOOD_COPY_ID: FoodCopy = {
  headerCityLabel: "MAKANAN · YOGYAKARTA",
  searchPlaceholder: "kopi dekat Malioboro · makanan Indonesia murah · buka sekarang…",
  emptyResultsTitle: "Belum ada yang cocok.",
  emptyResultsHint: "Coba kata kunci lebih luas, atau hapus filter kategori.",
  categoryAll: "Semua",
  ratingReviews: (n) => `${n.toLocaleString("id-ID")} ulasan`,
  openLabel: "Buka",
  closedLabel: "Tutup",
  unknownStatusLabel: "Jam tidak diketahui",
  nexMemberBadge: "MEMBER NEX",
  invitedBadge: "DIUNDANG",
  notYetClaimedBadge: "BISNIS LOKAL",
  businessBeingVerified: "Informasi bisnis sedang diverifikasi",
  backToList: "Kembali",
  aboutSection: "Tentang",
  menuSection: "Menu",
  menuComingSoon: "Menu segera hadir",
  noMenuUnclaimed: "Restoran ini belum bergabung dengan NEX — menu akan muncul setelah pemilik mengklaim dan mempublikasikannya.",
  unavailable: "Tidak tersedia",
  contactAction: "Kontak",
  inviteToNexAction: "Undang bisnis ini ke NEX",
  ownerClaimHint: "Apakah Anda pemiliknya? Klaim listing ini.",
};

export function pickFoodCopy(language: "en" | "id"): FoodCopy {
  return language === "id" ? FOOD_COPY_ID : FOOD_COPY_EN;
}
