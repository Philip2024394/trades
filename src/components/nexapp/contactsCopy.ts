// NEX Contacts · English + Indonesian copy · plain data module (no
// React) so it compiles as a tiny leaf. Kept separate from
// ContactsPanel to reduce webpack per-file heap peak on the 8 GB Victus
// (three OOMs during initial compile → file split 2026-08-21).

export type ContactsCopy = {
  createGroup: string;
  connectAction: string;
  emptyKicker: string;
  emptyMessage: string;
  groupsSection: string;
  contactsSection: string;
  yourNexId: string;
  selectMembersTitle: string;
  selectMembersHint: string;
  nameGroupTitle: string;
  membersLower: string;
  groupNameLabel: string;
  groupNamePlaceholder: string;
  autoGenerateAvatar: string;
  connectStepTitle: string;
  connectLabel: string;
  connectBtn: string;
  connectInvalid: string;
  connectPlaceholderReply: string;
  soon: string;
  cancel: string;
  next: string;
  back: string;
  create: string;
  actMessage: string;
  actViewProfile: string;
  actBlock: string;
  actUnblock: string;
  actReport: string;
  toastGroupSoon: string;
  toastConversationSoon: string;
  toastGroupCreated: string;
  toastBlocked: string;
  toastUnblocked: string;
  groupCreatedFirstLine: string;
};

export const COPY_EN: ContactsCopy = {
  createGroup: "Create Group",
  connectAction: "Connect a NEX ID",
  emptyKicker: "Your NEX network starts here.",
  emptyMessage: "Share your NEX ID or create a group with someone you'll add soon.",
  groupsSection: "Groups",
  contactsSection: "Contacts",
  yourNexId: "Your NEX ID",
  selectMembersTitle: "Select members",
  selectMembersHint: "Pick at least two contacts. {n} selected.",
  nameGroupTitle: "Name your group",
  membersLower: "members",
  groupNameLabel: "Group name",
  groupNamePlaceholder: "e.g. Building Team",
  autoGenerateAvatar: "Auto-generate a group image for now",
  connectStepTitle: "Connect a NEX ID",
  connectLabel: "Enter a NEX ID",
  connectBtn: "Connect",
  connectInvalid: "That NEX ID doesn't look right. Example: NEX-A7X2-K9M4",
  connectPlaceholderReply: "Connection system is coming soon. The ID you entered ({id}) is valid.",
  soon: "NEX-to-NEX chat + groups arrive with Priority 4.",
  cancel: "Cancel",
  next: "Next",
  back: "Back",
  create: "Create Group",
  actMessage: "Message",
  actViewProfile: "View profile",
  actBlock: "Block",
  actUnblock: "Unblock",
  actReport: "Report",
  toastGroupSoon: "Group conversation opens when NEX-to-NEX ships.",
  toastConversationSoon: "One-to-one conversation opens when NEX-to-NEX ships.",
  toastGroupCreated: "Group created.",
  toastBlocked: "Contact blocked.",
  toastUnblocked: "Contact unblocked.",
  groupCreatedFirstLine: "Group created — say hi",
};

export const COPY_ID: ContactsCopy = {
  createGroup: "Buat Grup",
  connectAction: "Terhubung dengan NEX ID",
  emptyKicker: "Jaringan NEX Anda dimulai di sini.",
  emptyMessage: "Bagikan NEX ID Anda atau buat grup dengan orang yang akan Anda tambahkan segera.",
  groupsSection: "Grup",
  contactsSection: "Kontak",
  yourNexId: "NEX ID Anda",
  selectMembersTitle: "Pilih anggota",
  selectMembersHint: "Pilih minimal dua kontak. {n} dipilih.",
  nameGroupTitle: "Beri nama grup Anda",
  membersLower: "anggota",
  groupNameLabel: "Nama grup",
  groupNamePlaceholder: "cth. Tim Bangunan",
  autoGenerateAvatar: "Buat gambar grup otomatis untuk sekarang",
  connectStepTitle: "Terhubung dengan NEX ID",
  connectLabel: "Masukkan NEX ID",
  connectBtn: "Terhubung",
  connectInvalid: "Format NEX ID tidak valid. Contoh: NEX-A7X2-K9M4",
  connectPlaceholderReply: "Sistem koneksi akan segera hadir. ID yang Anda masukkan ({id}) valid.",
  soon: "Chat NEX-ke-NEX + grup hadir dengan Prioritas 4.",
  cancel: "Batal",
  next: "Berikutnya",
  back: "Kembali",
  create: "Buat Grup",
  actMessage: "Pesan",
  actViewProfile: "Lihat profil",
  actBlock: "Blokir",
  actUnblock: "Buka blokir",
  actReport: "Laporkan",
  toastGroupSoon: "Chat grup terbuka saat NEX-ke-NEX hadir.",
  toastConversationSoon: "Chat satu-lawan-satu terbuka saat NEX-ke-NEX hadir.",
  toastGroupCreated: "Grup dibuat.",
  toastBlocked: "Kontak diblokir.",
  toastUnblocked: "Kontak dibuka blokirnya.",
  groupCreatedFirstLine: "Grup dibuat — sapa dulu",
};

export function pickCopy(language: "en" | "id"): ContactsCopy {
  return language === "id" ? COPY_ID : COPY_EN;
}
