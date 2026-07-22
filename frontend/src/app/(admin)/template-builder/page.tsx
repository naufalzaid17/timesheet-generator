"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Upload,
  Save,
  Loader2,
  Trash2,
  MousePointerClick,
  Tag,
} from "lucide-react";
import { api, API_BASE, getToken } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Template, CellMapping, MappingField, MappingScope } from "@/lib/types";

// Handsontable manipulates the DOM on import, so load the wrapper client-only.
const HotGrid = dynamic(() => import("@/components/HotGrid"), { ssr: false });

// Field catalogue the admin can assign to cells/columns.
const FIELD_OPTIONS: { value: MappingField; label: string; scope: MappingScope }[] = [
  { value: "date", label: "Date (per day)", scope: "daily_column" },
  { value: "time_in", label: "Time In (per day)", scope: "daily_column" },
  { value: "time_out", label: "Time Out (per day)", scope: "daily_column" },
  { value: "status", label: "Status (per day)", scope: "daily_column" },
  { value: "activity", label: "Activity Remark (per day)", scope: "daily_column" },
  { value: "project_name", label: "Project Name (per day)", scope: "daily_column" },
  { value: "project_id", label: "Project ID (per day)", scope: "daily_column" },
  { value: "app_impacted", label: "App Impacted (per day)", scope: "daily_column" },
  { value: "meta_name", label: "Employee Name (cell)", scope: "cell" },
  { value: "meta_mii_id", label: "MII ID (cell)", scope: "cell" },
  { value: "meta_division", label: "Division (cell)", scope: "cell" },
  { value: "meta_site", label: "Site (cell)", scope: "cell" },
  { value: "meta_month", label: "Month (cell)", scope: "cell" },
  { value: "meta_year", label: "Year (cell)", scope: "cell" },
];

// Convert a 0-based column index to spreadsheet letters (0 -> A, 26 -> AA).
function colToLetter(col: number): string {
  let s = "";
  let n = col;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export default function TemplateBuilderPage() {
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [grid, setGrid] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<CellMapping[]>([]);
  const [selection, setSelection] = useState<{ row: number; col: number } | null>(null);
  const [field, setField] = useState<MappingField>("date");
  const [fillable, setFillable] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const list = await api<Template[]>("/api/templates");
      setTemplates(list);
      if (list.length && activeId === null) setActiveId(list[0].id);
    } catch (err: any) {
      notify(err.message, "error");
    }
  }, [notify, activeId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load the grid + existing mappings whenever the active template changes.
  useEffect(() => {
    if (activeId === null) return;
    (async () => {
      setLoadingGrid(true);
      try {
        const [gridRes, tmpl] = await Promise.all([
          api<{ grid: any[][] }>(`/api/templates/${activeId}/grid`),
          api<Template[]>("/api/templates").then((all) => all.find((t) => t.id === activeId)),
        ]);
        setGrid(gridRes.grid || []);
        setMappings(tmpl?.cell_mappings || []);
      } catch (err: any) {
        notify(err.message, "error");
      } finally {
        setLoadingGrid(false);
      }
    })();
  }, [activeId, notify]);

  const selectedField = useMemo(
    () => FIELD_OPTIONS.find((f) => f.value === field)!,
    [field]
  );

  const addMapping = () => {
    if (!selection) {
      notify("Click a cell in the grid first", "info");
      return;
    }
    const { row, col } = selection;
    const letter = colToLetter(col);
    const rowNum = row + 1; // grid row 0 == spreadsheet row 1

    const scope = selectedField.scope;
    const mapping: CellMapping =
      scope === "daily_column"
        ? { field, scope, column: letter, start_row: rowNum, fillable }
        : { field, scope, cell_ref: `${letter}${rowNum}`, fillable: false };

    // Replace any existing mapping for the same field.
    setMappings((prev) => [...prev.filter((m) => m.field !== field), mapping]);
    notify(`Mapped ${field} → ${letter}${rowNum}`, "success");
  };

  const removeMapping = (f: MappingField) =>
    setMappings((prev) => prev.filter((m) => m.field !== f));

  const save = async () => {
    if (activeId === null) return;
    setSaving(true);
    try {
      await api(`/api/admin/templates/${activeId}/mappings`, {
        method: "POST",
        body: JSON.stringify({ mappings }),
      });
      notify("Mapping saved", "success");
      loadTemplates();
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name.replace(/\.xlsx$/i, ""));
      const res = await fetch(`${API_BASE}/api/admin/templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error);
      }
      const tmpl: Template = await res.json();
      notify("Template uploaded", "success");
      await loadTemplates();
      setActiveId(tmpl.id);
    } catch (err: any) {
      notify(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Highlight mapped cells/columns in the grid.
  const mappedCells = useMemo(() => {
    const map = new Map<string, MappingField>();
    mappings.forEach((m) => {
      if (m.scope === "cell" && m.cell_ref) {
        map.set(m.cell_ref, m.field);
      }
    });
    return map;
  }, [mappings]);

  const mappedColumns = useMemo(() => {
    const map = new Map<string, MappingField>();
    mappings.forEach((m) => {
      if (m.scope === "daily_column" && m.column) map.set(m.column, m.field);
    });
    return map;
  }, [mappings]);

  const cells = useCallback(
    (row: number, col: number) => {
      const letter = colToLetter(col);
      const ref = `${letter}${row + 1}`;
      const meta: any = { readOnly: true };
      if (mappedCells.has(ref)) {
        meta.className = "ht-mapped-cell";
      } else if (mappedColumns.has(letter)) {
        meta.className = "ht-mapped-col";
      }
      return meta;
    },
    [mappedCells, mappedColumns]
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Template Builder</h1>
          <p className="text-sm text-mr-muted">
            Upload a client template, then click cells to map their purpose.
          </p>
        </div>
        <label className="btn-accent cursor-pointer">
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Upload .xlsx
          <input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />
        </label>
      </header>

      {/* Template tabs */}
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`chip px-4 py-2 ${
                activeId === t.id
                  ? "bg-mr-purple text-white"
                  : "bg-mr-surface text-mr-ink border border-mr-ink"
              }`}
            >
              <Tag size={14} /> {t.name}
              {t.is_default && <span className="ml-1 text-[10px] opacity-70">default</span>}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Grid */}
        <div className="card p-4 lg:col-span-3">
          {loadingGrid ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-mr-purple" />
            </div>
          ) : grid.length ? (
            <HotGrid
              data={grid}
              readOnly
              height={520}
              cells={cells}
              afterSelectionEnd={(r, c) => setSelection({ row: r, col: c })}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-mr-muted">
              <MousePointerClick size={32} />
              <p>Upload a template to begin mapping.</p>
            </div>
          )}
        </div>

        {/* Mapping panel */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Assign field</h2>
            <div className="mb-3  bg-mr-surface2 p-3 text-sm">
              {selection ? (
                <span className="font-semibold text-mr-purple">
                  Selected: {colToLetter(selection.col)}
                  {selection.row + 1}
                </span>
              ) : (
                <span className="text-mr-muted">Click a cell in the grid…</span>
              )}
            </div>

            <label className="mb-1 block text-sm font-semibold">Purpose</label>
            <select
              className="input mb-3"
              value={field}
              onChange={(e) => setField(e.target.value as MappingField)}
            >
              {FIELD_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {selectedField.scope === "daily_column" && (
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fillable}
                  onChange={(e) => setFillable(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Users may edit this column
              </label>
            )}

            <p className="mb-3 text-xs text-mr-muted">
              {selectedField.scope === "daily_column"
                ? "Anchors day 1 at the selected row; subsequent days fill downward."
                : "Maps a single fixed cell (header metadata)."}
            </p>

            <button onClick={addMapping} className="btn-primary w-full">
              <MousePointerClick size={16} /> Map selected cell
            </button>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Mappings</h2>
              <span className="chip bg-mr-surface2 text-mr-muted">{mappings.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {mappings.length === 0 && (
                <p className="text-sm text-mr-muted">No mappings yet.</p>
              )}
              {mappings.map((m) => (
                <div
                  key={m.field}
                  className="flex items-center justify-between  bg-mr-surface2 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{m.field}</p>
                    <p className="text-xs text-mr-muted">
                      {m.scope === "daily_column"
                        ? `Col ${m.column} · row ${m.start_row}${m.fillable ? " · fillable" : ""}`
                        : `Cell ${m.cell_ref}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMapping(m.field)}
                    className=" p-1.5 text-mr-muted hover:bg-mr-pink hover:text-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={save}
              disabled={saving || activeId === null}
              className="btn-primary mt-4 w-full"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
