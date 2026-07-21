package services

import (
	"bytes"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"

	"timesheet-backend/models"
)

// ParseXLSXGrid reads the given sheet of an uploaded template into a 2-D string
// grid suitable for rendering in Handsontable on the admin template builder.
// When sheetName is empty the first sheet is used.
func ParseXLSXGrid(data []byte, sheetName string) (grid [][]string, resolvedSheet string, err error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}
	defer f.Close()

	if sheetName == "" {
		sheetName = f.GetSheetName(0)
	}
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, "", err
	}
	return rows, sheetName, nil
}

// generationInput bundles everything needed to render a user's monthly file.
type GenerationInput struct {
	Template   *models.Template
	Mappings   []models.CellMapping
	User       *models.User
	Month      int
	Year       int
	Activities []models.DailyActivity
}

// GenerateFromTemplate injects a user's stored activities into the admin-mapped
// cells of a template and returns the resulting .xlsx bytes. Rows for days
// beyond the month's length are cleared so client templates that ship with a
// fixed 31-row block are trimmed to the correct length.
func GenerateFromTemplate(in GenerationInput) ([]byte, error) {
	f, err := excelize.OpenReader(bytes.NewReader(in.Template.FileData))
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer f.Close()

	sheet := in.Template.SheetName
	if sheet == "" {
		sheet = f.GetSheetName(0)
	}

	// Index activities by day-of-month for O(1) lookup.
	byDay := make(map[int]models.DailyActivity, len(in.Activities))
	for _, a := range in.Activities {
		byDay[a.Date.Day()] = a
	}

	daysInMonth := GetDaysInMonth(in.Year, in.Month)

	// Split mappings by scope.
	var cellMaps []models.CellMapping
	var dailyMaps []models.CellMapping
	for _, m := range in.Mappings {
		switch m.Scope {
		case models.ScopeDailyColumn:
			dailyMaps = append(dailyMaps, m)
		default:
			cellMaps = append(cellMaps, m)
		}
	}

	// 1. Static metadata cells.
	for _, m := range cellMaps {
		if m.CellRef == "" {
			continue
		}
		if v := metaValue(m.Field, in); v != "" {
			if err := f.SetCellValue(sheet, m.CellRef, v); err != nil {
				return nil, fmt.Errorf("set meta cell %s: %w", m.CellRef, err)
			}
		}
	}

	// 2. Daily columns: write one row per calendar day, trim the rest.
	// Track the maximum StartRow so we know where the block ends for trimming.
	maxTemplateRow := 0
	for _, m := range dailyMaps {
		if m.StartRow > maxTemplateRow {
			maxTemplateRow = m.StartRow
		}
	}

	for _, m := range dailyMaps {
		if m.Column == "" || m.StartRow == 0 {
			continue
		}
		for day := 1; day <= 31; day++ {
			row := m.StartRow + (day - 1)
			cell := fmt.Sprintf("%s%d", m.Column, row)
			if day > daysInMonth {
				// Trim excess rows for short months.
				_ = f.SetCellValue(sheet, cell, "")
				continue
			}
			act, ok := byDay[day]
			value := dailyValue(m.Field, act, ok, in.Year, in.Month, day)
			if err := f.SetCellValue(sheet, cell, value); err != nil {
				return nil, fmt.Errorf("set daily cell %s: %w", cell, err)
			}
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// metaValue resolves a static metadata field from the generation input.
func metaValue(field models.MappingFieldType, in GenerationInput) string {
	switch field {
	case models.FieldMetaName:
		return in.User.Name
	case models.FieldMetaMiiID:
		return in.User.MiiID
	case models.FieldMetaDivision:
		return in.User.Division
	case models.FieldMetaSite:
		return in.User.Site
	case models.FieldMetaMonth:
		return time.Month(in.Month).String()
	case models.FieldMetaYear:
		return fmt.Sprintf("%d", in.Year)
	}
	return ""
}

// dailyValue resolves a per-day column value for a given field and day.
func dailyValue(field models.MappingFieldType, act models.DailyActivity, hasActivity bool, year, month, day int) interface{} {
	switch field {
	case models.FieldDate:
		return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	}
	if !hasActivity {
		return ""
	}
	switch field {
	case models.FieldTimeIn:
		return act.StartTime
	case models.FieldTimeOut:
		return act.EndTime
	case models.FieldStatus:
		return act.Status
	case models.FieldActivity:
		return act.Activity
	case models.FieldProjectName:
		return act.ProjectName
	case models.FieldProjectID:
		return act.ProjectID
	case models.FieldAppImpacted:
		return act.AppImpacted
	}
	return ""
}
