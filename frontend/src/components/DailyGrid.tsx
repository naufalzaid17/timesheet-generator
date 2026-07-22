"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Clock, Info, Trash2, MousePointerClick, CheckCheck, X, Wand2, Eraser } from "lucide-react";
import { DailyEntryInput } from "../types";

interface DailyGridProps {
  dailyEntries: DailyEntryInput[];
  daysCount: number;
  year: string;
  month: string;
  holidays: { [key: string]: string };
  handleClearAll: () => void;
  handleUpdateEntry: (day: number, field: keyof DailyEntryInput, value: any) => void;
  handleBulkUpdate: (days: number[], updates: Partial<DailyEntryInput>) => void;
  handleTimeChange: (day: number, field: "startTime" | "endTime", val: string) => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "P", label: "Present" },
  { value: "S", label: "Sick" },
  { value: "BT", label: "Business Trip" },
  { value: "PM", label: "Permit" },
  { value: "V", label: "Vacation" },
  { value: "X", label: "Not Working" },
];

const EMPTY_BULK = {
  status: "",
  startTime: "",
  endTime: "",
  activity: "",
  projectName: "",
  projectId: "",
  appImpacted: "",
  division: "",
  department: "",
};

export function DailyGrid({
  dailyEntries,
  daysCount,
  year,
  month,
  holidays,
  handleClearAll,
  handleUpdateEntry,
  handleBulkUpdate,
  handleTimeChange,
}: DailyGridProps) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ---- Per-day metadata (weekend / holiday / label), memoized ---------------
  const dayMeta = useMemo(() => {
    const map: Record<number, {
      dayLabel: string;
      holidayDesc?: string;
      isWeekend: boolean;
      isHoliday: boolean;
      isInactive: boolean;
    }> = {};
    dailyEntries.forEach(entry => {
      const date = new Date(parseInt(year), parseInt(month) - 1, entry.day);
      const dStr = `${year}-${pad(parseInt(month))}-${pad(entry.day)}`;
      const holidayDesc = holidays[dStr];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isHoliday = !!holidayDesc;
      map[entry.day] = {
        dayLabel: `${pad(entry.day)} (${daysOfWeek[date.getDay()]})`,
        holidayDesc,
        isWeekend,
        isHoliday,
        isInactive: isWeekend || isHoliday,
      };
    });
    return map;
  }, [dailyEntries, year, month, holidays]);

  // Ordered list of days that can actually be selected/edited (working days).
  const activeDays = useMemo(
    () => dailyEntries.map(e => e.day).filter(d => dayMeta[d] && !dayMeta[d].isInactive),
    [dailyEntries, dayMeta]
  );

  // ---- Range selection state (Handsontable-style) ---------------------------
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);

  const dragging = useRef(false);
  const dragBase = useRef<Set<number>>(new Set()); // selection to union the drag range onto
  const dragAnchor = useRef<number | null>(null);

  // Prune selection if the grid changes (e.g. month switch removes days).
  useEffect(() => {
    setSelected(prev => {
      const next = new Set<number>();
      prev.forEach(d => {
        if (dayMeta[d] && !dayMeta[d].isInactive) next.add(d);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [dayMeta]);

  // Global mouseup ends any drag-selection, wherever it's released.
  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  // Escape clears the current selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Days between two anchors (inclusive), restricted to selectable days.
  const rangeDays = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return activeDays.filter(d => d >= lo && d <= hi);
  };

  const isSelectable = (day: number) => dayMeta[day] && !dayMeta[day].isInactive;

  const beginSelect = (day: number, e: React.MouseEvent) => {
    if (!isSelectable(day)) return;
    e.preventDefault(); // avoid native text selection while dragging
    dragging.current = true;

    const additive = e.ctrlKey || e.metaKey;

    if (e.shiftKey && anchor != null) {
      // Extend a contiguous range from the existing anchor.
      const base = additive ? new Set(selected) : new Set<number>();
      rangeDays(anchor, day).forEach(d => base.add(d));
      dragBase.current = additive ? new Set(selected) : new Set<number>();
      dragAnchor.current = anchor;
      setSelected(base);
    } else if (additive) {
      // Toggle a single day without clearing the rest (non-contiguous select).
      const next = new Set(selected);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      dragBase.current = new Set(next);
      dragAnchor.current = day;
      setAnchor(day);
      setSelected(next);
    } else {
      // Plain click: start a brand-new single-cell selection / drag anchor.
      dragBase.current = new Set<number>();
      dragAnchor.current = day;
      setAnchor(day);
      setSelected(new Set([day]));
    }
  };

  const extendSelect = (day: number) => {
    if (!dragging.current || dragAnchor.current == null) return;
    if (!isSelectable(day)) return;
    const next = new Set(dragBase.current);
    rangeDays(dragAnchor.current, day).forEach(d => next.add(d));
    setSelected(next);
  };

  const toggleKeyboard = (day: number, e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!isSelectable(day)) return;
    const next = new Set(selected);
    if (e.shiftKey && anchor != null) {
      rangeDays(anchor, day).forEach(d => next.add(d));
    } else if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setAnchor(day);
    setSelected(next);
  };

  const selectAllWorking = () => setSelected(new Set(activeDays));
  const clearSelection = () => setSelected(new Set());

  const selectedCount = selected.size;
  const allSelected = activeDays.length > 0 && selectedCount === activeDays.length;

  // ---- Bulk edit form -------------------------------------------------------
  const [bulk, setBulk] = useState({ ...EMPTY_BULK });

  const applyBulk = () => {
    if (selectedCount === 0) return;
    const updates: Partial<DailyEntryInput> = {};
    (Object.keys(bulk) as (keyof typeof bulk)[]).forEach(k => {
      if (bulk[k] !== "") (updates as any)[k] = bulk[k];
    });
    if (Object.keys(updates).length === 0) return;
    handleBulkUpdate(Array.from(selected), updates);
  };

  const applyWorkingPreset = () => {
    if (selectedCount === 0) return;
    handleBulkUpdate(Array.from(selected), { status: "P", startTime: "08:00", endTime: "17:00" });
  };

  const clearSelectedContent = () => {
    if (selectedCount === 0) return;
    handleBulkUpdate(Array.from(selected), {
      startTime: "00:00",
      endTime: "00:00",
      status: "",
      activity: "",
      projectName: "",
      projectId: "",
      appImpacted: "",
      division: "",
      department: "",
    });
  };

  const bulkFieldClass =
    "border-2 border-black p-1.5 bg-white text-black font-bold text-xs w-full focus:outline-none focus:ring-2 focus:ring-neoPurple";
  const bulkBtnClass =
    "flex items-center justify-center gap-1.5 border-2 border-black font-extrabold py-1.5 px-3 text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

  return (
    <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 border-black pb-4 mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Clock className="w-8 h-8 text-neoPink" /> DAILY ACTIVITY GRID ({daysCount} DAYS)
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={selectAllWorking}
            className={`${bulkBtnClass} bg-neoCyan text-black`}
          >
            <CheckCheck className="w-4 h-4" /> {allSelected ? "RESELECT" : "SELECT WORKING"}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className={`${bulkBtnClass} bg-neoPink text-white`}
          >
            <Trash2 className="w-4 h-4" /> CLEAR ALL
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div className="bg-blue-50 border-2 border-black p-3 mb-4 text-xs font-bold flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <span>
          Weekends and public holidays are grayed out. <b>Click a day to select it</b>, <b>Shift+Click</b> to select a
          range, <b>Ctrl/⌘+Click</b> to toggle individual days, or <b>drag across days</b> to select many at once. Then use
          the bulk toolbar to fill all selected days in one go. Press <b>Esc</b> to clear the selection.
        </span>
      </div>

      {/* Bulk-edit toolbar (appears when days are selected) */}
      {selectedCount > 0 && (
        <div className="bg-neoYellow border-4 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-sm font-black uppercase flex items-center gap-2">
              <MousePointerClick className="w-5 h-5" /> {selectedCount} DAY{selectedCount > 1 ? "S" : ""} SELECTED
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className={`${bulkBtnClass} bg-white text-black`}
            >
              <X className="w-4 h-4" /> DESELECT
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Status
              <select
                aria-label="Bulk status"
                value={bulk.status}
                onChange={(e) => setBulk({ ...bulk, status: e.target.value })}
                className={bulkFieldClass}
              >
                <option value="">— No change —</option>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Start Time
              <input
                aria-label="Bulk start time"
                type="text"
                maxLength={5}
                placeholder="HH:mm"
                value={bulk.startTime}
                onChange={(e) => setBulk({ ...bulk, startTime: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              End Time
              <input
                aria-label="Bulk end time"
                type="text"
                maxLength={5}
                placeholder="HH:mm"
                value={bulk.endTime}
                onChange={(e) => setBulk({ ...bulk, endTime: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Activity / Remark
              <input
                aria-label="Bulk activity"
                type="text"
                placeholder="Activity…"
                value={bulk.activity}
                onChange={(e) => setBulk({ ...bulk, activity: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Project Name
              <input
                aria-label="Bulk project name"
                type="text"
                placeholder="Project…"
                value={bulk.projectName}
                onChange={(e) => setBulk({ ...bulk, projectName: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Project ID
              <input
                aria-label="Bulk project id"
                type="text"
                placeholder="ID…"
                value={bulk.projectId}
                onChange={(e) => setBulk({ ...bulk, projectId: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              App Impacted
              <input
                aria-label="Bulk app impacted"
                type="text"
                placeholder="App…"
                value={bulk.appImpacted}
                onChange={(e) => setBulk({ ...bulk, appImpacted: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Division
              <input
                aria-label="Bulk division"
                type="text"
                placeholder="Division…"
                value={bulk.division}
                onChange={(e) => setBulk({ ...bulk, division: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
              Department
              <input
                aria-label="Bulk department"
                type="text"
                placeholder="Dept…"
                value={bulk.department}
                onChange={(e) => setBulk({ ...bulk, department: e.target.value })}
                className={bulkFieldClass}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={applyBulk} className={`${bulkBtnClass} bg-neoPurple text-white`}>
              <Wand2 className="w-4 h-4" /> APPLY TO {selectedCount}
            </button>
            <button type="button" onClick={applyWorkingPreset} className={`${bulkBtnClass} bg-neoCyan text-black`}>
              <CheckCheck className="w-4 h-4" /> WORKING DAY (P · 08:00–17:00)
            </button>
            <button type="button" onClick={clearSelectedContent} className={`${bulkBtnClass} bg-white text-black`}>
              <Eraser className="w-4 h-4" /> CLEAR SELECTED
            </button>
            <button type="button" onClick={() => setBulk({ ...EMPTY_BULK })} className={`${bulkBtnClass} bg-white text-black`}>
              RESET FIELDS
            </button>
            <span className="text-[10px] font-bold text-gray-700">
              Only filled fields are applied. Times use 24-hour HH:mm.
            </span>
          </div>
        </div>
      )}

      {/* Scrollable grid container */}
      <div className="overflow-x-auto border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-black text-white font-black text-xs uppercase divide-x divide-gray-700">
              <th className="p-3 text-center w-[110px]">
                <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    aria-label="Select all working days"
                    checked={allSelected}
                    onChange={(e) => (e.target.checked ? selectAllWorking() : clearSelection())}
                    className="w-3.5 h-3.5 accent-neoPurple cursor-pointer"
                  />
                  DAY
                </label>
              </th>
              <th className="p-3 text-center w-[100px]">STATUS</th>
              <th className="p-3 text-center w-[120px]">START TIME</th>
              <th className="p-3 text-center w-[120px]">END TIME</th>
              <th className="p-3 w-[250px]">ACTIVITY / REMARK</th>
              <th className="p-3 w-[150px]">PROJECT NAME</th>
              <th className="p-3 w-[100px]">PROJECT ID</th>
              <th className="p-3 w-[120px]">APP IMPACTED</th>
              <th className="p-3 w-[120px]">DIVISION</th>
              <th className="p-3 w-[150px]">DEPARTMENT</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black text-xs font-bold">
            {dailyEntries.map(entry => {
              const meta = dayMeta[entry.day];
              if (!meta) return null;
              const { dayLabel, holidayDesc, isWeekend, isHoliday, isInactive } = meta;
              const isSelected = selected.has(entry.day);

              return (
                <tr
                  key={entry.day}
                  className={`divide-x divide-black transition-all ${
                    isSelected
                      ? "bg-purple-100"
                      : isInactive
                        ? "bg-gray-200 text-gray-500"
                        : "hover:bg-yellow-50/30 bg-white"
                  }`}
                >
                  {/* Day label — doubles as the row selector */}
                  <td
                    role={isInactive ? undefined : "button"}
                    tabIndex={isInactive ? undefined : 0}
                    aria-pressed={isInactive ? undefined : isSelected}
                    aria-label={isInactive ? undefined : `Select day ${entry.day}`}
                    onMouseDown={(e) => beginSelect(entry.day, e)}
                    onMouseEnter={() => extendSelect(entry.day)}
                    onKeyDown={(e) => toggleKeyboard(entry.day, e)}
                    className={`p-2 text-center font-black select-none ${
                      isInactive ? "cursor-not-allowed" : "cursor-pointer"
                    } ${
                      isSelected
                        ? "bg-neoPurple text-white ring-2 ring-inset ring-black"
                        : isHoliday
                          ? "bg-red-100 text-red-700"
                          : isWeekend
                            ? "bg-gray-300 text-gray-700"
                            : "bg-white text-black hover:bg-neoYellow"
                    }`}
                  >
                    {dayLabel}
                  </td>

                  {/* Status select */}
                  <td className="p-1">
                    <select
                      id={`status-${entry.day}`}
                      name={`status-${entry.day}`}
                      aria-label={`Status for day ${entry.day}`}
                      value={entry.status}
                      onChange={(e) => handleUpdateEntry(entry.day, "status", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold text-center disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    >
                      <option value="">-</option>
                      <option value="P">Present</option>
                      <option value="S">Sick</option>
                      <option value="BT">Business Trip</option>
                      <option value="PM">Permit</option>
                      <option value="V">Vacation</option>
                      <option value="X">Not Working</option>
                    </select>
                  </td>

                  {/* Start Time */}
                  <td className="p-1">
                    <input
                      id={`startTime-${entry.day}`}
                      name={`startTime-${entry.day}`}
                      aria-label={`Start time for day ${entry.day}`}
                      type="text"
                      value={entry.startTime}
                      placeholder="00:00"
                      maxLength={5}
                      onChange={(e) => handleTimeChange(entry.day, "startTime", e.target.value)}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "00:00") {
                          handleUpdateEntry(entry.day, "startTime", "00:00");
                          return;
                        }

                        let formatted = val;
                        const cleanDigits = val.replace(/[^0-9]/g, "");

                        if (/^[0-9]{1,2}$/.test(cleanDigits)) {
                          const num = parseInt(cleanDigits);
                          if (num >= 0 && num <= 23) {
                            formatted = `${num.toString().padStart(2, "0")}:00`;
                          }
                        } else if (/^[0-9]{3,4}$/.test(cleanDigits)) {
                          let h = 0, m = 0;
                          if (cleanDigits.length === 3) {
                            h = parseInt(cleanDigits.substring(0, 1));
                            m = parseInt(cleanDigits.substring(1));
                          } else {
                            h = parseInt(cleanDigits.substring(0, 2));
                            m = parseInt(cleanDigits.substring(2));
                          }
                          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                            formatted = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                          }
                        }

                        const isValid = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(formatted);
                        if (isValid) {
                          handleUpdateEntry(entry.day, "startTime", formatted);
                        } else {
                          handleUpdateEntry(entry.day, "startTime", "00:00");
                        }
                      }}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold text-center disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* End Time */}
                  <td className="p-1">
                    <input
                      id={`endTime-${entry.day}`}
                      name={`endTime-${entry.day}`}
                      aria-label={`End time for day ${entry.day}`}
                      type="text"
                      value={entry.endTime}
                      placeholder="00:00"
                      maxLength={5}
                      onChange={(e) => handleTimeChange(entry.day, "endTime", e.target.value)}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "00:00") {
                          handleUpdateEntry(entry.day, "endTime", "00:00");
                          return;
                        }

                        let formatted = val;
                        const cleanDigits = val.replace(/[^0-9]/g, "");

                        if (/^[0-9]{1,2}$/.test(cleanDigits)) {
                          const num = parseInt(cleanDigits);
                          if (num >= 0 && num <= 23) {
                            formatted = `${num.toString().padStart(2, "0")}:00`;
                          }
                        } else if (/^[0-9]{3,4}$/.test(cleanDigits)) {
                          let h = 0, m = 0;
                          if (cleanDigits.length === 3) {
                            h = parseInt(cleanDigits.substring(0, 1));
                            m = parseInt(cleanDigits.substring(1));
                          } else {
                            h = parseInt(cleanDigits.substring(0, 2));
                            m = parseInt(cleanDigits.substring(2));
                          }
                          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                            formatted = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                          }
                        }

                        const isValid = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(formatted);
                        if (isValid) {
                          handleUpdateEntry(entry.day, "endTime", formatted);
                        } else {
                          handleUpdateEntry(entry.day, "endTime", "00:00");
                        }
                      }}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold text-center disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* Activity */}
                  <td className="p-1">
                    <input
                      id={`activity-${entry.day}`}
                      name={`activity-${entry.day}`}
                      aria-label={`Activity for day ${entry.day}`}
                      type="text"
                      value={entry.activity}
                      placeholder={isHoliday ? holidayDesc : isWeekend ? "Weekend" : "Activity description..."}
                      onChange={(e) => handleUpdateEntry(entry.day, "activity", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* Project Name */}
                  <td className="p-1">
                    <input
                      id={`projectName-${entry.day}`}
                      name={`projectName-${entry.day}`}
                      aria-label={`Project name for day ${entry.day}`}
                      type="text"
                      value={entry.projectName}
                      placeholder="Project..."
                      onChange={(e) => handleUpdateEntry(entry.day, "projectName", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* Project ID */}
                  <td className="p-1">
                    <input
                      id={`projectId-${entry.day}`}
                      name={`projectId-${entry.day}`}
                      aria-label={`Project ID for day ${entry.day}`}
                      type="text"
                      value={entry.projectId}
                      placeholder="ID..."
                      onChange={(e) => handleUpdateEntry(entry.day, "projectId", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold text-center disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* App Impacted */}
                  <td className="p-1">
                    <input
                      id={`appImpacted-${entry.day}`}
                      name={`appImpacted-${entry.day}`}
                      aria-label={`App impacted for day ${entry.day}`}
                      type="text"
                      value={entry.appImpacted}
                      placeholder="App..."
                      onChange={(e) => handleUpdateEntry(entry.day, "appImpacted", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* Division */}
                  <td className="p-1">
                    <input
                      id={`division-${entry.day}`}
                      name={`division-${entry.day}`}
                      aria-label={`Division for day ${entry.day}`}
                      type="text"
                      value={entry.division}
                      placeholder="Division..."
                      onChange={(e) => handleUpdateEntry(entry.day, "division", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>

                  {/* Department */}
                  <td className="p-1">
                    <input
                      id={`department-${entry.day}`}
                      name={`department-${entry.day}`}
                      aria-label={`Department for day ${entry.day}`}
                      type="text"
                      value={entry.department}
                      placeholder="Dept..."
                      onChange={(e) => handleUpdateEntry(entry.day, "department", e.target.value)}
                      className="w-full border border-black p-1.5 bg-white text-black font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={isInactive}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
