// src/lib/nex/i18n/keys.ts
//
// Stage 3.33 · Phase 26 · Typed key registry (Philip 2026-08-31).
// Phase B.7 · P4 Vault universal string migration (Philip 2026-10-07).
//
// Every user-facing string in the app chrome (buttons, nav, section
// headers, empty-state copy) MUST have a key here. The `useT` hook
// only accepts keys from this union so a missing translation is a
// compile-time error, not a silent English fallback.
//
// Naming convention: `namespace.subject.form`
//   nav.messages           → nav item label
//   messenger.title        → messenger screen heading
//   vault.setup.welcome.*  → Vault setup welcome step strings
//
// Growing the registry: add a key here + add an entry to both packs
// in ./packs/en.ts and ./packs/id.ts. TypeScript will refuse to compile
// if either pack is missing a key.

export const I18N_KEYS = [
  // ─── Common ─────────────────────────────────────────────────
  "common.back",
  "common.close",
  "common.continue",
  "common.cancel",
  "common.save",
  "common.loading",
  "common.error",
  "common.more",
  "common.workingEllipsis",

  // ─── Nav ────────────────────────────────────────────────────
  "nav.home",
  "nav.messages",
  "nav.discover",
  "nav.profile",

  // ─── Messenger ──────────────────────────────────────────────
  "messenger.title",
  "messenger.subtitle",
  "messenger.searchPlaceholder",
  "messenger.emptyStateTitle",
  "messenger.emptyStateBody",
  "messenger.newChat",
  "messenger.previewTitle",
  "messenger.previewSubtitle",
  "messenger.translated",
  "messenger.original",
  "messenger.showOriginal",
  "messenger.showTranslated",

  // ─── Sign-on ────────────────────────────────────────────────
  "signon.welcome",
  "signon.continueBtn",
  "signon.guestBtn",

  // ─── Settings · Language picker (Phase B.7 P1-P3 dogfood) ───
  "settings.language.eyebrow",
  "settings.language.title",
  "settings.language.lede",
  "settings.language.save",
  "settings.language.id_label",
  "settings.language.id_blurb",
  "settings.language.en_label",
  "settings.language.en_blurb",

  // ═══ Phase B.7 P4 · Vault universal string migration ════════

  // ─── Vault setup ───────────────────────────────────────────
  "vault.setup.brandChip",
  "vault.setup.welcome.title",
  "vault.setup.welcome.body",
  "vault.setup.welcome.ctaReady",
  "vault.setup.welcome.ctaPreparing",
  "vault.setup.choose.title",
  "vault.setup.choose.pin.title",
  "vault.setup.choose.pin.blurb",
  "vault.setup.choose.passphrase.title",
  "vault.setup.choose.passphrase.blurb",
  "vault.setup.pin.title",
  "vault.setup.passphrase.title",
  "vault.setup.pin.rangeHintTemplate",
  "vault.setup.passphrase.rangeHintTemplate",
  "vault.setup.pin.placeholder",
  "vault.setup.pin.confirmPlaceholder",
  "vault.setup.passphrase.placeholder",
  "vault.setup.passphrase.confirmPlaceholder",
  "vault.setup.pin.mismatch",
  "vault.setup.passphrase.mismatch",
  "vault.setup.createCta",
  "vault.setup.backBtn",
  "vault.setup.workingMessage",
  "vault.setup.errorBannerDefault",
  "vault.setup.error.alreadyConfigured",
  "vault.setup.error.deviceNotRegistered",
  "vault.setup.error.deviceRevoked",
  "vault.setup.error.saveFailed",
  "vault.setup.error.generic",

  // ─── Vault home ────────────────────────────────────────────
  "vault.home.brandNex",
  "vault.home.brandVault",
  "vault.home.tagline",
  "vault.home.heroEyebrow",
  "vault.home.heroBody",
  "vault.home.chats.sectionTitle",
  "vault.home.chats.empty.title",
  "vault.home.chats.empty.body",
  "vault.home.friendsVaulted.one",
  "vault.home.friendsVaulted.many",
  "vault.home.contacts.sectionTitle",
  "vault.home.contacts.rowTitle",
  "vault.home.contacts.rowBlurb",
  "vault.home.cat.documents.label",
  "vault.home.cat.documents.blurb",
  "vault.home.cat.photos.label",
  "vault.home.cat.photos.blurb",
  "vault.home.cat.videos.label",
  "vault.home.cat.videos.blurb",
  "vault.home.cat.plans.label",
  "vault.home.cat.plans.blurb",
  "vault.home.cat.important.label",
  "vault.home.cat.important.blurb",
  "vault.home.cat.archived.label",
  "vault.home.cat.archived.blurb",
  "vault.home.settingsLinkLabel",
  "vault.home.lockBtn.unlocked",
  "vault.home.lockBtn.locked",
  "vault.home.chatRow.handleFallback",

  // ─── Vault settings ────────────────────────────────────────
  "vault.settings.header.title",
  "vault.settings.header.subtitle",
  "vault.settings.header.backLabel",
  "vault.settings.doorTheme.title",
  "vault.settings.doorTheme.body",
  "vault.settings.lockVault.title",
  "vault.settings.lockVault.body",
  "vault.settings.devices.title",
  "vault.settings.devices.body",
  "vault.settings.recovery.title",
  "vault.settings.recovery.body",
  "vault.settings.rotate.title",
  "vault.settings.rotate.body",
  "vault.settings.backToNex.title",
  "vault.settings.backToNex.body",
  "vault.settings.about.title",
  "vault.settings.about.body",
  "vault.settings.honestLimits.title",
  "vault.settings.honestLimits.para1",
  "vault.settings.honestLimits.para2",
  "vault.settings.honestLimits.para3",

  // ─── Vault chat (sealed B.4) ───────────────────────────────
  "vault.chat.header.vaultBadge",
  "vault.chat.header.subtitleProtected",
  "vault.chat.header.subtitleLocked",
  "vault.chat.header.lockBtn",
  "vault.chat.header.backLabel",
  "vault.chat.locked.iconLabel",
  "vault.chat.locked.title",
  "vault.chat.locked.body",
  "vault.chat.locked.pinPlaceholder",
  "vault.chat.locked.unlockBtn",
  "vault.chat.locked.unlockingBtn",
  "vault.chat.ready.loading",
  "vault.chat.ready.errorFallback",
  "vault.chat.ready.emptyBody",
  "vault.chat.composer.textPlaceholder",
  "vault.chat.composer.textPlaceholderLoading",
  "vault.chat.composer.sendBtn",
  "vault.chat.composer.sendBtnBusy",
  "vault.chat.composer.attachLabel",
  "vault.chat.composer.attachmentRemove",
  "vault.chat.composer.pendingAttachmentReadyTemplate",
  "vault.chat.attachment.labelImage",
  "vault.chat.attachment.labelVideo",
  "vault.chat.attachment.labelAudio",
  "vault.chat.attachment.wordImage",
  "vault.chat.attachment.wordVideo",
  "vault.chat.attachment.wordAudio",
  "vault.chat.setupError.conversationFailedTemplate",
  "vault.chat.setupError.loadFailed",
  "vault.chat.sendError.failedTemplate",
  "vault.chat.sendError.generic",
  "vault.chat.attachmentError",

  // ─── Vault settings · Devices (sealed) ─────────────────────
  "vault.devices.page.title",
  "vault.devices.page.subtitle",
  "vault.devices.lastSeenPrefix",

  // ─── Vault Contacts (enhancement + localization) ───────────
  "vault.contacts.header.title",
  "vault.contacts.header.subtitle",
  "vault.contacts.header.backLabel",
  "vault.contacts.search.placeholder",
  "vault.contacts.search.ariaLabel",
  "vault.contacts.empty.noneTitle",
  "vault.contacts.empty.noneBody",
  "vault.contacts.empty.noMatchTitle",
  "vault.contacts.empty.noMatchBody",
  "vault.contacts.row.defaultName",
  "vault.contacts.row.defaultHandle",
  "vault.contacts.row.seenPrefixTemplate",
  "vault.contacts.vaultBadge",
  "vault.contacts.listAriaLabel",
  "vault.contacts.actions.menuAriaLabelTemplate",
  "vault.contacts.actions.kebabAriaLabelTemplate",
  "vault.contacts.actions.moveOut.label",
  "vault.contacts.actions.moveOut.hintTemplate",
  "vault.contacts.actions.delete.label",
  "vault.contacts.actions.delete.hint",
  "vault.contacts.actions.block.label",
  "vault.contacts.actions.block.hintTemplate",
  "vault.contacts.confirm.move.title",
  "vault.contacts.confirm.move.bodyTemplate",
  "vault.contacts.confirm.move.cancel",
  "vault.contacts.confirm.move.confirm",
  "vault.contacts.confirm.delete.title",
  "vault.contacts.confirm.delete.bodyTemplate",
  "vault.contacts.confirm.delete.confirm",
  "vault.contacts.confirm.block.titleTemplate",
  "vault.contacts.confirm.block.body",
  "vault.contacts.confirm.block.confirm",
  "vault.contacts.confirm.workingLabel",
] as const;

export type I18nKey = (typeof I18N_KEYS)[number];
