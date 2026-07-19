// UserMenuDropdownMount — server wrapper that resolves the identity
// context and hands it to the client UserMenuDropdown. Use this in
// server components / layouts so the dropdown renders with the right
// identity on first paint (no client fetch flash).

import { resolveUserMenuContext } from "@/lib/userMenuContext";
import { UserMenuDropdown }        from "./UserMenuDropdown";

export async function UserMenuDropdownMount() {
  const ctx = await resolveUserMenuContext();
  return <UserMenuDropdown ctx={ctx}/>;
}
