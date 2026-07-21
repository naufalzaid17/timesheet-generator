"use client";

import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

// The dashboard and other user routes require an authenticated user session.
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard role="user">
      <Shell>{children}</Shell>
    </Guard>
  );
}
