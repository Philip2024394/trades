// Shared /home layout — mounts the entity switcher chip at the top of
// every homeowner surface, without stealing any vertical space from the
// underlying pages.

import { EntityChip } from "./EntityChip";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-40 md:right-6 md:top-6">
        <div className="pointer-events-auto">
          <EntityChip />
        </div>
      </div>
      {children}
    </>
  );
}
