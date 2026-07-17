import React from "react";
import { Building, Calendar } from "lucide-react";

interface MetadataFormProps {
  month: string;
  setMonth: (m: string) => void;
  year: string;
  setYear: (y: string) => void;
  name: string;
  setName: (n: string) => void;
  miiId: string;
  setMiiId: (id: string) => void;
  project: string;
  setProject: (p: string) => void;
  division: string;
  setDivision: (d: string) => void;
  site: string;
  setSite: (s: string) => void;
  signatureReviewer: string;
  setSignatureReviewer: (r: string) => void;
  signatureApprover: string;
  setSignatureApprover: (a: string) => void;
  format: "excel" | "pdf";
  setFormat: (f: "excel" | "pdf") => void;
  loadingHolidays: boolean;
}

export function MetadataForm({
  month,
  setMonth,
  year,
  setYear,
  name,
  setName,
  miiId,
  setMiiId,
  project,
  setProject,
  division,
  setDivision,
  site,
  setSite,
  signatureReviewer,
  setSignatureReviewer,
  signatureApprover,
  setSignatureApprover,
  format,
  setFormat,
  loadingHolidays,
}: MetadataFormProps) {
  return (
    <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
      <h2 className="text-2xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6 flex items-center gap-3">
        <Building className="w-8 h-8 text-neoCyan" /> HEADER & SIGNATURE METADATA
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Period Selection */}
        <div className="space-y-4 border-4 border-black p-4 bg-[#F9F9F9]">
          <h3 className="text-sm font-black uppercase bg-black text-white px-2 py-1 inline-block">
            1. REPORTING PERIOD
          </h3>
          
          <div>
            <label htmlFor="month-select" className="block text-xs font-black uppercase mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Month
            </label>
            <select 
              id="month-select"
              name="month"
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className="w-full border-2 border-black p-2 bg-white font-bold text-sm focus:outline-none"
            >
              <option value="1">01 - January</option>
              <option value="2">02 - February</option>
              <option value="3">03 - March</option>
              <option value="4">04 - April</option>
              <option value="5">05 - May</option>
              <option value="6">06 - June</option>
              <option value="7">07 - July</option>
              <option value="8">08 - August</option>
              <option value="9">09 - September</option>
              <option value="10">10 - October</option>
              <option value="11">11 - November</option>
              <option value="12">12 - December</option>
            </select>
          </div>

          <div>
            <label htmlFor="year-input" className="block text-xs font-black uppercase mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Year
            </label>
            <input 
              id="year-input"
              name="year"
              type="number" 
              min="1900" 
              max="2099" 
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full border-2 border-black p-2 bg-white font-bold text-sm focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              disabled
            />
          </div>

          {loadingHolidays && (
            <div className="flex items-center gap-2 text-xs font-black text-neoPurple">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> FETCHING HOLIDAYS...
            </div>
          )}
        </div>

        {/* Column 2: Header Metadata */}
        <div className="space-y-4 border-4 border-black p-4 bg-[#F9F9F9]">
          <h3 className="text-sm font-black uppercase bg-black text-white px-2 py-1 inline-block">
            2. EXCEL ROW HEADERS
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="fullName-input" className="block text-[10px] font-black uppercase mb-1">Full Name</label>
              <input 
                id="fullName-input"
                name="fullName"
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="miiId-input" className="block text-[10px] font-black uppercase mb-1">MII ID</label>
              <input 
                id="miiId-input"
                name="miiId"
                type="text" 
                value={miiId} 
                onChange={(e) => setMiiId(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="projectName-input" className="block text-[10px] font-black uppercase mb-1">Project Name</label>
            <input 
              id="projectName-input"
              name="projectName"
              type="text" 
              value={project} 
              onChange={(e) => setProject(e.target.value)}
              className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="division-input" className="block text-[10px] font-black uppercase mb-1">Division</label>
              <input 
                id="division-input"
                name="division"
                type="text" 
                value={division} 
                onChange={(e) => setDivision(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="site-input" className="block text-[10px] font-black uppercase mb-1">Site</label>
              <input 
                id="site-input"
                name="site"
                type="text" 
                value={site} 
                onChange={(e) => setSite(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Approver & Format */}
        <div className="space-y-4 border-4 border-black p-4 bg-[#F9F9F9]">
          <h3 className="text-sm font-black uppercase bg-black text-white px-2 py-1 inline-block">
            3. APPROVALS & EXPORT
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="signatureReviewer-input" className="block text-[10px] font-black uppercase mb-1">Reviewer (D43)</label>
              <input 
                id="signatureReviewer-input"
                name="signatureReviewer"
                type="text" 
                value={signatureReviewer} 
                onChange={(e) => setSignatureReviewer(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="signatureApprover-input" className="block text-[10px] font-black uppercase mb-1">Approver (G43)</label>
              <input 
                id="signatureApprover-input"
                name="signatureApprover"
                type="text" 
                value={signatureApprover} 
                onChange={(e) => setSignatureApprover(e.target.value)}
                className="w-full border-2 border-black p-1.5 bg-white font-bold text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-black uppercase mb-1.5">Output Format</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("excel")}
                className={`py-2 border-2 border-black font-extrabold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all ${
                  format === "excel" 
                    ? "bg-neoYellow text-black" 
                    : "bg-white text-black"
                }`}
              >
                EXCEL (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`py-2 border-2 border-black font-extrabold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all ${
                  format === "pdf" 
                    ? "bg-neoPink text-white" 
                    : "bg-white text-black"
                }`}
              >
                PDF (.pdf)
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
