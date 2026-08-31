// src/app/nex-driver-register/page.tsx
//
// DEPRECATED · compatibility redirect shim · one-release migration window.
// Canonical path is /nex-provider-register (mobility doctrine v5 · Provider
// not Driver). Remove this file after the migration window closes.

import { permanentRedirect } from "next/navigation";

export default function DriverRegisterRedirect(): never {
  permanentRedirect("/nex-provider-register");
}
