import React from "react";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="bg-neoYellow border-4 border-black p-6 md:p-8 mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
      <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none mb-3">
        TIMESHEET GENERATOR
      </h1>
      <p className="text-lg md:text-xl font-bold border-t-2 border-black pt-2 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-neoPurple animate-bounce" />
        Fill daily entries below, verify holidays, and output strict Excel/PDF A4 sheets instantly!
      </p>
    </header>
  );
}
