"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Download, RefreshCw, Clock } from "lucide-react";

import { Header } from "../components/Header";
import { MetadataForm } from "../components/MetadataForm";
import { StatusMessage } from "../components/StatusMessage";
import { Footer } from "../components/Footer";
import { DailyEntryInput } from "../types";

// Handsontable touches the DOM on load, so the grid is client-only (no SSR).
const DailyGrid = dynamic(() => import("../components/DailyGrid").then(m => m.DailyGrid), {
  ssr: false,
  loading: () => (
    <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8 flex items-center gap-3 font-black uppercase">
      <Clock className="w-6 h-6 animate-spin text-neoPink" /> Loading daily activity grid…
    </div>
  ),
});

export default function Home() {
  // Form states
  const [month, setMonth] = useState("7");
  const [year, setYear] = useState("2026");
  const [format, setFormat] = useState<"excel" | "pdf">("excel");
  
  // Header metadata
  const [name, setName] = useState("");
  const [miiId, setMiiId] = useState("");
  const [project, setProject] = useState("");
  const [division, setDivision] = useState("");
  const [site, setSite] = useState("");
  
  // Signature blocks
  const [signatureEmployee, setSignatureEmployee] = useState("");
  const [signatureReviewer, setSignatureReviewer] = useState("");
  const [signatureApprover, setSignatureApprover] = useState("");

  // Dynamic daily grid state
  const [dailyEntries, setDailyEntries] = useState<DailyEntryInput[]>([]);
  const [holidays, setHolidays] = useState<{ [key: string]: string }>({});

  // Status states
  const [loading, setLoading] = useState(false);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [daysCount, setDaysCount] = useState<number>(31);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const hasLoadedDraftRef = useRef(false);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem("timesheet_draft_data");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        hasLoadedDraftRef.current = true;
        
        if (draft.name !== undefined) setName(draft.name);
        if (draft.miiId !== undefined) setMiiId(draft.miiId);
        if (draft.project !== undefined) setProject(draft.project);
        if (draft.division !== undefined) setDivision(draft.division);
        if (draft.site !== undefined) setSite(draft.site);
        if (draft.month !== undefined) setMonth(draft.month);
        if (draft.year !== undefined) setYear(draft.year);
        if (draft.format !== undefined) setFormat(draft.format);
        if (draft.signatureEmployee !== undefined) setSignatureEmployee(draft.signatureEmployee);
        if (draft.signatureReviewer !== undefined) setSignatureReviewer(draft.signatureReviewer);
        if (draft.signatureApprover !== undefined) setSignatureApprover(draft.signatureApprover);
        if (draft.dailyEntries !== undefined && Array.isArray(draft.dailyEntries)) {
          setDailyEntries(draft.dailyEntries);
        }
      } catch (e) {
        console.error("Failed to parse timesheet draft data:", e);
      }
    }
  }, []);

  // Fetch holidays client-side and initialize grid
  useEffect(() => {
    const loadDaysAndHolidays = async () => {
      const y = parseInt(year);
      const m = parseInt(month);
      if (isNaN(y) || isNaN(m) || m < 1 || m > 12 || y < 1900) return;

      setLoadingHolidays(true);
      const hMap: { [key: string]: string } = {};

      try {
        const apiHost = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${apiHost}/api/holidays?year=${y}&month=${m}`);
        if (res.ok) {
          const holidaysList = await res.json();
          if (holidaysList && Array.isArray(holidaysList)) {
            holidaysList.forEach((h: any) => {
              hMap[h.date] = h.description;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch holidays via backend:", err);
      } finally {
        setLoadingHolidays(false);
      }

      setHolidays(hMap);

      const days = new Date(y, m, 0).getDate();
      setDaysCount(days);

      // If we just restored from local storage draft, skip reconstructing daily entries for the initial render
      if (hasLoadedDraftRef.current) {
        hasLoadedDraftRef.current = false;
        return;
      }

      // Construct daily entries
      const entries: DailyEntryInput[] = [];
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m - 1, d);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const dStr = `${y}-${pad(m)}-${pad(d)}`;
        const holidayDesc = hMap[dStr];
        const isHoliday = !!holidayDesc;

        entries.push({
          day: d,
          startTime: isWeekend || isHoliday ? "00:00" : "08:00",
          endTime: isWeekend || isHoliday ? "00:00" : "17:00",
          status: "",
          activity: isHoliday ? holidayDesc : "",
          projectName: isWeekend || isHoliday ? "" : project,
          projectId: "",
          appImpacted: "",
          division: isWeekend || isHoliday ? "" : division,
          department: "",
        });
      }
      setDailyEntries(entries);
    };

    loadDaysAndHolidays();
  }, [month, year]);

  // Sync Signature Employee when Name changes
  useEffect(() => {
    setSignatureEmployee(name);
  }, [name]);

  // Auto-save draft to localStorage on form changes
  useEffect(() => {
    // Check if there is any modified grid cell data
    const hasGridData = dailyEntries.some(entry => {
      const date = new Date(parseInt(year), parseInt(month) - 1, entry.day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dStr = `${year}-${pad(parseInt(month))}-${pad(entry.day)}`;
      const holidayDesc = holidays[dStr];
      const isHoliday = !!holidayDesc;
      
      const defaultStart = isWeekend || isHoliday ? "00:00" : "08:00";
      const defaultEnd = isWeekend || isHoliday ? "00:00" : "17:00";
      
      return entry.status !== "" ||
             entry.startTime !== defaultStart ||
             entry.endTime !== defaultEnd ||
             (entry.activity !== "" && entry.activity !== holidayDesc) ||
             entry.projectName !== "" ||
             entry.projectId !== "" ||
             entry.appImpacted !== "" ||
             entry.division !== "" ||
             entry.department !== "";
    });

    const hasData = name !== "" || 
                    miiId !== "" || 
                    project !== "" || 
                    division !== "" || 
                    site !== "" || 
                    signatureReviewer !== "" || 
                    signatureApprover !== "" ||
                    hasGridData;

    if (!hasData) {
      localStorage.removeItem("timesheet_draft_data");
      return;
    }

    const draft = {
      name,
      miiId,
      project,
      division,
      site,
      month,
      year,
      format,
      signatureEmployee,
      signatureReviewer,
      signatureApprover,
      dailyEntries
    };
    localStorage.setItem("timesheet_draft_data", JSON.stringify(draft));
  }, [name, miiId, project, division, site, month, year, format, signatureEmployee, signatureReviewer, signatureApprover, dailyEntries, holidays]);

  // Autofill all working days helper
  const handleAutofill = () => {
    setDailyEntries(prev => prev.map(entry => {
      const date = new Date(parseInt(year), parseInt(month) - 1, entry.day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dStr = `${year}-${pad(parseInt(month))}-${pad(entry.day)}`;
      const holidayDesc = holidays[dStr];
      const isHoliday = !!holidayDesc;

      if (isWeekend || isHoliday) {
        return entry; // Keep weekend/holiday values
      }

      return {
        ...entry,
        startTime: "08:00",
        endTime: "17:00",
        status: "P",
        projectName: project || entry.projectName,
        projectId: entry.projectId || "",
        appImpacted: entry.appImpacted || "",
        division: division || entry.division,
        department: entry.department || "",
        activity: entry.activity || "Developing features and resolving codebase issues",
      };
    }));
  };

  // Clear all entries helper
  const handleClearAll = () => {
    setDailyEntries(prev => prev.map(entry => ({
      ...entry,
      startTime: "00:00",
      endTime: "00:00",
      status: "",
      activity: "",
      projectName: "",
      projectId: "",
      appImpacted: "",
      division: "",
      department: "",
    })));
  };

  // Apply a partial set of fields to one or many days at once
  // (single-cell edits, bulk multi-select edits, and grid sync all flow through here).
  const handleBulkUpdate = (days: number[], updates: Partial<DailyEntryInput>) => {
    const daySet = new Set(days);
    setDailyEntries(prev => prev.map(entry =>
      daySet.has(entry.day) ? { ...entry, ...updates } : entry
    ));
  };

  // Form submission handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const apiHost = process.env.NEXT_PUBLIC_API_URL || "";
    const apiUrl = `${apiHost}/api/timesheet`;

    // Map frontend entries to backend expectation
    const formattedEntries = dailyEntries.map(entry => ({
      day: entry.day,
      start_time: entry.startTime,
      end_time: entry.endTime,
      status: entry.status,
      activity: entry.activity,
      project_name: entry.projectName,
      project_id: entry.projectId,
      app_impacted: entry.appImpacted,
      division: entry.division,
      department: entry.department
    }));

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month: parseInt(month),
          year: parseInt(year),
          format,
          project,
          division,
          name,
          mii_id: miiId,
          site,
          signature_employee: signatureEmployee,
          signature_reviewer: signatureReviewer,
          signature_approver: signatureApprover,
          daily_entries: formattedEntries
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = "Failed to generate timesheet";
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errMsg;
        } catch (e) {
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      const ext = format === "excel" ? "xlsx" : "pdf";
      const padMonth = month.padStart(2, "0");
      link.setAttribute("download", `Timesheet_${padMonth}_${year}.${ext}`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      // Clean local storage draft and clear fields if downloaded successfully
      localStorage.removeItem("timesheet_draft_data");
      setName("");
      setMiiId("");
      setProject("");
      setDivision("");
      setSite("");
      setSignatureEmployee("");
      setSignatureReviewer("");
      setSignatureApprover("");
      handleClearAll();

      setSuccess(`Successfully generated and downloaded Timesheet_${padMonth}_${year}.${ext}!`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while connecting to the timesheet service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <Header />

      <MetadataForm
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        name={name}
        setName={setName}
        miiId={miiId}
        setMiiId={setMiiId}
        project={project}
        setProject={setProject}
        division={division}
        setDivision={setDivision}
        site={site}
        setSite={setSite}
        signatureReviewer={signatureReviewer}
        setSignatureReviewer={setSignatureReviewer}
        signatureApprover={signatureApprover}
        setSignatureApprover={setSignatureApprover}
        format={format}
        setFormat={setFormat}
        loadingHolidays={loadingHolidays}
      />

      <DailyGrid
        dailyEntries={dailyEntries}
        daysCount={daysCount}
        year={year}
        month={month}
        holidays={holidays}
        handleClearAll={handleClearAll}
        handleBulkUpdate={handleBulkUpdate}
      />

      <StatusMessage error={error} success={success} />

      {/* Submission Button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className={`w-full py-4 border-4 border-black text-xl font-black uppercase tracking-wider shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all ${
          loading 
            ? "bg-gray-300 text-gray-500 cursor-not-allowed translate-x-[4px] translate-y-[4px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" 
            : "bg-neoPurple text-white hover:bg-black hover:text-white hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" /> GENERATING TIMESHEET... PLEASE STAND BY
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Download className="w-6 h-6" /> GENERATE & DOWNLOAD TIMESHEET
          </span>
        )}
      </button>

      <Footer />
    </main>
  );
}
