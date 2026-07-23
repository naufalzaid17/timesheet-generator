"use client";

import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

// All /users and /template-builder routes require an admin session.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard role="admin">
      <Shell>{children}</Shell>
    </Guard>
  );
}
