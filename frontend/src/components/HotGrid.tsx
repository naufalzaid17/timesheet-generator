"use client";

// Client-only Handsontable wrapper. Handsontable touches the DOM at import
// time, so the whole module is dynamically imported with ssr:false by callers.

import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import { forwardRef } from "react";
import type Handsontable from "handsontable";

registerAllModules();

export interface HotGridProps {
  data: any[][];
  colHeaders?: boolean | string[];
  rowHeaders?: boolean;
  cells?: (row: number, col: number) => Partial<Handsontable.CellMeta>;
  afterSelectionEnd?: (r: number, c: number, r2: number, c2: number) => void;
  afterChange?: (changes: any, source: string) => void;
  readOnly?: boolean;
  height?: number | string;
  colWidths?: number | number[];
  // Merged-cell regions ({row, col, rowspan, colspan}) to reproduce a template's
  // layout in the preview.
  mergeCells?: { row: number; col: number; rowspan: number; colspan: number }[];
}

const HotGrid = forwardRef<any, HotGridProps>(function HotGrid(props, ref) {
  return (
    <HotTable
      ref={ref}
      data={props.data}
      colHeaders={props.colHeaders ?? true}
      rowHeaders={props.rowHeaders ?? true}
      cells={props.cells}
      afterSelectionEnd={props.afterSelectionEnd}
      afterChange={props.afterChange}
      readOnly={props.readOnly}
      height={props.height ?? 460}
      colWidths={props.colWidths}
      mergeCells={props.mergeCells}
      width="100%"
      stretchH={props.mergeCells ? "none" : "all"}
      manualColumnResize
      licenseKey="non-commercial-and-evaluation"
      className="ht-mr"
    />
  );
});

export default HotGrid;
