"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  LayoutTemplate,
  LogOut,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { href: "/users", label: "Users", icon: Users },
  { href: "/template-builder", label: "Template Builder", icon: LayoutTemplate },
];

const userNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// Shell provides the friendly, rounded sidebar + top bar used by all
// authenticated pages.
export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const nav = user?.role === "admin" ? adminNav : userNav;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="card sticky top-6 p-5">
            <div className="mb-6 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-saweria-yellow">
                <CalendarCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight">Timesheet</p>
                <p className="text-xs text-saweria-slate">Portal</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-saweria-purple text-white shadow-soft"
                        : "text-saweria-ink hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center gap-3 px-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-saweria-purple/10 text-sm font-bold text-saweria-purple">
                  {(user?.name || user?.username || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user?.name || user?.username}</p>
                  <p className="truncate text-xs capitalize text-saweria-slate">{user?.role}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="btn-ghost w-full text-sm">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Mobile top bar */}
          <div className="card mb-4 flex items-center justify-between p-3 md:hidden">
            <span className="font-extrabold">Timesheet Portal</span>
            <button onClick={handleLogout} className="btn-ghost text-sm">
              <LogOut size={16} />
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
