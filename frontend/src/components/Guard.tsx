"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

// Guard gates a page behind authentication and (optionally) a required role.
// It renders a friendly loading state while the session resolves and redirects
// unauthenticated or unauthorized users away.
export default function Guard({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (role && user.role !== role) {
      router.replace(user.role === "admin" ? "/users" : "/dashboard");
    }
  }, [user, loading, role, router]);

  if (loading || !user || (role && user.role !== role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-saweria-purple/20 border-t-saweria-purple" />
          <p className="text-sm text-saweria-slate">Loading your portal…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
