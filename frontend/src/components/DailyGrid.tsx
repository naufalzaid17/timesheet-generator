"use client";

import React, { useMemo, useRef, useState } from "react";
import { HotTable, HotTableClass } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { Clock, Info, Trash2, MousePointerClick, CheckCheck, X, Wand2, Eraser } from "lucide-react";
import { DailyEntryInput } from "../types";

// Register all Handsontable cell types, plugins, renderers, editors, etc.
registerAllModules();

interface DailyGridProps {
  dailyEntries: DailyEntryInput[];
  daysCount: number;
  year: string;
  month: string;
  holidays: { [key: string]: string };
  handleClearAll: () => void;
  handleBulkUpdate: (days: number[], updates: Partial<DailyEntryInput>) => void;
}

// Backend stores compact status codes; the grid shows human-readable labels.
const STATUS_CODE_TO_LABEL: Record<string, string> = {
  "": "",
  P: "Present",
  S: "Sick",
  BT: "Business Trip",
  PM: "Permit",
  V: "Vacation",
  X: "Not Working",
};
const STATUS_LABEL_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CODE_TO_LABEL).map(([code, label]) => [label, code])
);
const STATUS_SOURCE = Object.values(STATUS_CODE_TO_LABEL); // ["", "Present", ...]

// Column layout (order matters — index maps to Handsontable columns).
const FIELDS: (keyof DailyEntryInput)[] = [
  "day",
  "status",
  "startTime",
  "endTime",
  "activity",
  "projectName",
  "projectId",
  "appImpacted",
  "division",
  "department",
];
const COL_HEADERS = [
  "DAY",
  "STATUS",
  "START TIME",
  "END TIME",
  "ACTIVITY / REMARK",
  "PROJECT NAME",
  "PROJECT ID",
  "APP IMPACTED",
  "DIVISION",
  "DEPARTMENT",
];
const COL_WIDTHS = [90, 130, 95, 95, 240, 150, 90, 120, 120, 150];
const CENTERED_COLS = new Set([0, 1, 2, 3, 6]); // day, status, times, project id
const LAST_COL = FIELDS.length - 1;

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
  handleBulkUpdate,
}: DailyGridProps) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const hotRef = useRef<HotTableClass>(null);

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

  // Grid rows for Handsontable (labels for status, computed day column).
  const hotData = useMemo(
    () =>
      dailyEntries.map(entry => ({
        day: dayMeta[entry.day]?.dayLabel ?? String(entry.day),
        status: STATUS_CODE_TO_LABEL[entry.status] ?? "",
        startTime: entry.startTime,
        endTime: entry.endTime,
        activity: entry.activity,
        projectName: entry.projectName,
        projectId: entry.projectId,
        appImpacted: entry.appImpacted,
        division: entry.division,
        department: entry.department,
      })),
    [dailyEntries, dayMeta]
  );

  const columns = useMemo(
    () =>
      FIELDS.map((field, col) => {
        const base: Handsontable.ColumnSettings = {
          data: field,
          className: CENTERED_COLS.has(col) ? "htCenter htMiddle" : "htMiddle",
        };
        if (field === "day") {
          base.readOnly = true;
        } else if (field === "status") {
          base.type = "dropdown";
          base.source = STATUS_SOURCE;
          base.allowInvalid = false;
        } else if (field === "startTime" || field === "endTime") {
          base.type = "time";
          base.timeFormat = "HH:mm";
          base.correctFormat = true;
        }
        return base;
      }),
    []
  );

  // Gray-out + lock weekend/holiday rows.
  const cells = (row: number) => {
    const cp: Handsontable.CellProperties = {} as Handsontable.CellProperties;
    const entry = dailyEntries[row];
    const meta = entry ? dayMeta[entry.day] : undefined;
    if (meta?.isInactive) {
      cp.readOnly = true;
      cp.className = `${meta.isHoliday ? "ht-holiday" : "ht-weekend"}`;
    }
    return cp;
  };

  // ---- Selection tracking (Handsontable selection API) ----------------------
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const readSelection = () => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const ranges = hot.getSelectedRange();
    const rows = new Set<number>();
    if (ranges) {
      ranges.forEach(range => {
        const fromRow = range.from.row ?? 0;
        const toRow = range.to.row ?? 0;
        const from = Math.min(fromRow, toRow);
        const to = Math.max(fromRow, toRow);
        for (let r = from; r <= to; r++) rows.add(r);
      });
    }
    const days: number[] = [];
    rows.forEach(r => {
      const entry = dailyEntries[r];
      if (entry && !dayMeta[entry.day]?.isInactive) days.push(entry.day);
    });
    setSelectedDays(days);
  };

  const selectAllWorking = () => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const ranges: [number, number, number, number][] = [];
    dailyEntries.forEach((entry, row) => {
      if (!dayMeta[entry.day]?.isInactive) ranges.push([row, 0, row, LAST_COL]);
    });
    if (ranges.length) {
      hot.selectCells(ranges);
      hot.deselectCell(); // keep the grid visually calm; selection state is captured below
    }
    setSelectedDays(dailyEntries.filter(e => !dayMeta[e.day]?.isInactive).map(e => e.day));
  };

  const clearSelection = () => {
    hotRef.current?.hotInstance?.deselectCell();
    setSelectedDays([]);
  };

  const selectedCount = selectedDays.length;
  const activeCount = useMemo(
    () => dailyEntries.filter(e => !dayMeta[e.day]?.isInactive).length,
    [dailyEntries, dayMeta]
  );
  const allSelected = activeCount > 0 && selectedCount === activeCount;

  // ---- Sync grid edits back into React state --------------------------------
  const onAfterChange = (
    changes: Handsontable.CellChange[] | null,
    source: Handsontable.ChangeSource
  ) => {
    if (!changes || source === "loadData" || source === "updateData") return;

    const updatesByDay: Record<number, Partial<DailyEntryInput>> = {};
    changes.forEach(([row, prop, , nextValue]) => {
      const entry = dailyEntries[row];
      if (!entry) return;
      const field = prop as keyof DailyEntryInput;
      if (field === "day") return; // read-only

      let value: any = nextValue ?? "";
      if (field === "status") {
        value = STATUS_LABEL_TO_CODE[value] ?? "";
      } else if (field === "startTime" || field === "endTime") {
        // Keep backend-friendly HH:mm; blanks fall back to 00:00.
        value = value === "" ? "00:00" : value;
      }
      updatesByDay[entry.day] = { ...updatesByDay[entry.day], [field]: value };
    });

    Object.entries(updatesByDay).forEach(([day, upd]) => {
      handleBulkUpdate([Number(day)], upd);
    });
  };

  // ---- Bulk edit form -------------------------------------------------------
  const [bulk, setBulk] = useState({ ...EMPTY_BULK });

  const applyBulk = () => {
    if (selectedCount === 0) return;
    const updates: Partial<DailyEntryInput> = {};
    (Object.keys(bulk) as (keyof typeof bulk)[]).forEach(k => {
      if (bulk[k] !== "") (updates as any)[k] = bulk[k];
    });
    if (Object.keys(updates).length === 0) return;
    handleBulkUpdate(selectedDays, updates);
  };

  const applyWorkingPreset = () => {
    if (selectedCount === 0) return;
    handleBulkUpdate(selectedDays, { status: "P", startTime: "08:00", endTime: "17:00" });
  };

  const clearSelectedContent = () => {
    if (selectedCount === 0) return;
    handleBulkUpdate(selectedDays, {
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
          <button type="button" onClick={selectAllWorking} className={`${bulkBtnClass} bg-neoCyan text-black`}>
            <CheckCheck className="w-4 h-4" /> {allSelected ? "RESELECT" : "SELECT WORKING"}
          </button>
          <button type="button" onClick={handleClearAll} className={`${bulkBtnClass} bg-neoPink text-white`}>
            <Trash2 className="w-4 h-4" /> CLEAR ALL
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div className="bg-blue-50 border-2 border-black p-3 mb-4 text-xs font-bold flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <span>
          Powered by the Handsontable data grid. Weekends and public holidays are grayed out and locked.{" "}
          <b>Click &amp; drag</b> to select a range of cells, <b>Shift/Ctrl+Click</b> to extend or toggle,{" "}
          use the <b>fill handle</b> (bottom-right of a selection) to copy down, and <b>Ctrl+C / Ctrl+V</b> to
          copy-paste. Select any days, then use the bulk toolbar to fill them all at once.
        </span>
      </div>

      {/* Bulk-edit toolbar (acts on the current grid selection) */}
      {selectedCount > 0 && (
        <div className="bg-neoYellow border-4 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-sm font-black uppercase flex items-center gap-2">
              <MousePointerClick className="w-5 h-5" /> {selectedCount} DAY{selectedCount > 1 ? "S" : ""} SELECTED
            </span>
            <button type="button" onClick={clearSelection} className={`${bulkBtnClass} bg-white text-black`}>
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
                {Object.entries(STATUS_CODE_TO_LABEL)
                  .filter(([code]) => code !== "")
                  .map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
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

      {/* Handsontable grid */}
      <div className="ht-theme-main border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <HotTable
          ref={hotRef}
          data={hotData}
          columns={columns}
          colHeaders={COL_HEADERS}
          colWidths={COL_WIDTHS}
          rowHeaders={false}
          width="100%"
          height="auto"
          stretchH="all"
          autoWrapRow
          autoWrapCol
          manualColumnResize
          contextMenu={["copy", "cut", "---------", "clear_column"]}
          fillHandle={{ direction: "vertical", autoInsertRow: false }}
          outsideClickDeselects={false}
          cells={cells}
          afterChange={onAfterChange}
          afterSelectionEnd={readSelection}
          licenseKey="non-commercial-and-evaluation"
        />
      </div>
    </section>
  );
}
