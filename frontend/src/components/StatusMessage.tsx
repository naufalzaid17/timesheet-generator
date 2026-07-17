import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface StatusMessageProps {
  error: string | null;
  success: string | null;
}

export function StatusMessage({ error, success }: StatusMessageProps) {
  return (
    <>
      {error && (
        <div className="bg-neoPink border-4 border-black p-4 text-black flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8">
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold uppercase text-sm">Error Encountered!</h4>
            <p className="font-bold text-xs mt-1 leading-normal">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-[#5cdb95] border-4 border-black p-4 text-black flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8">
          <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold uppercase text-sm">Download Successful!</h4>
            <p className="font-bold text-xs mt-1 leading-normal">{success}</p>
          </div>
        </div>
      )}
    </>
  );
}
