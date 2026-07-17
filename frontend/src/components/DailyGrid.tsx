import React from "react";
import { Clock, Info, Trash2 } from "lucide-react";
import { DailyEntryInput } from "../types";

interface DailyGridProps {
  dailyEntries: DailyEntryInput[];
  daysCount: number;
  year: string;
  month: string;
  holidays: { [key: string]: string };
  handleClearAll: () => void;
  handleUpdateEntry: (day: number, field: keyof DailyEntryInput, value: any) => void;
  handleTimeChange: (day: number, field: "startTime" | "endTime", val: string) => void;
}

export function DailyGrid({
  dailyEntries,
  daysCount,
  year,
  month,
  holidays,
  handleClearAll,
  handleUpdateEntry,
  handleTimeChange,
}: DailyGridProps) {
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 border-black pb-4 mb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Clock className="w-8 h-8 text-neoPink" /> DAILY ACTIVITY GRID ({daysCount} DAYS)
        </h2>
        
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 bg-neoPink text-white border-2 border-black font-extrabold py-2 px-4 text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
          >
            <Trash2 className="w-4 h-4" /> CLEAR ALL
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div className="bg-blue-50 border-2 border-black p-3 mb-4 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <Info className="w-5 h-5 text-blue-600 shrink-0" />
        <span>Weekends and public holidays are visually grayed out. For working days, select a status (Present, Sick, Business Trip, etc.) and fill times and metadata.</span>
      </div>

      {/* Scrollable grid container */}
      <div className="overflow-x-auto border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-black text-white font-black text-xs uppercase divide-x divide-gray-700">
              <th className="p-3 text-center w-[80px]">DAY</th>
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
              const date = new Date(parseInt(year), parseInt(month) - 1, entry.day);
              const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const dayLabel = `${pad(entry.day)} (${daysOfWeek[date.getDay()]})`;

              const dStr = `${year}-${pad(parseInt(month))}-${pad(entry.day)}`;
              const holidayDesc = holidays[dStr];
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isHoliday = !!holidayDesc;

              const isInactive = isWeekend || isHoliday;

              return (
                <tr 
                  key={entry.day}
                  className={`divide-x divide-black transition-all ${
                    isInactive 
                      ? "bg-gray-200 text-gray-500" 
                      : "hover:bg-yellow-50/30 bg-white"
                  }`}
                >
                  {/* Day label */}
                  <td className={`p-2 text-center font-black ${isHoliday ? "bg-red-100 text-red-700" : isWeekend ? "bg-gray-300 text-gray-700" : "bg-white text-black"}`}>
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
