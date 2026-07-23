"use client";

import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

// Account routes (e.g. /profile) are available to any authenticated user —
// both regular users and admins manage their own account and passkeys here.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <Shell>{children}</Shell>
    </Guard>
  );
}
