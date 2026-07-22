"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

// Square, framed light/dark switch matching the neobrutalist idiom.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex h-9 w-9 items-center justify-center border-2 border-mr-ink bg-mr-surface text-mr-ink shadow-hard-sm transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-md active:translate-x-0 active:translate-y-0 active:shadow-none ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
