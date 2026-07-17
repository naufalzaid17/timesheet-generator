package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"timesheet-backend/models"
	"timesheet-backend/services"
)

// CORSMiddleware sets up cross-origin resource sharing headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// GenerateTimesheetHandler handles the request to generate the timesheet
// @Summary Generate a timesheet file
// @Description Generate a monthly timesheet in Excel or PDF format based on input template, weekends, and holidays.
// @Accept json
// @Produce octet-stream
// @Produce json
// @Param request body models.TimesheetRequest true "Timesheet Request Body"
// @Success 200 {string} string "Binary file stream"
// @Failure 400 {object} map[string]interface{} "Bad request parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/timesheet [post]
func GenerateTimesheetHandler(c *gin.Context) {
	var req models.TimesheetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// 1. Asynchronously fetch holidays
	type holidayResult struct {
		holidays []models.Holiday
		err      error
	}
	holidayChan := make(chan holidayResult, 1)

	go func(y, m int) {
		h, err := services.FetchHolidays(y, m)
		holidayChan <- holidayResult{holidays: h, err: err}
	}(req.Year, req.Month)

	// 2. Block on holiday request completion
	hResult := <-holidayChan
	if hResult.err != nil {
		log.Printf("Warning: Failed to fetch holidays from API: %v. Proceeding without holiday metadata.", hResult.err)
	}

	holidayMap := make(map[string]string)
	for _, hol := range hResult.holidays {
		holidayMap[hol.Date] = hol.Description
	}

	// 3. Generate Excel bytes
	excelBytes, err := services.GenerateExcel(&req, holidayMap)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate timesheet Excel: " + err.Error()})
		return
	}

	filenamePrefix := fmt.Sprintf("Timesheet_%02d_%04d", req.Month, req.Year)

	// 4. Format Conversion & Response
	if req.Format == "excel" {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.xlsx", filenamePrefix))
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBytes)
		return
	}

	if req.Format == "pdf" {
		// Convert Excel buffer to PDF via Gotenberg
		pdfBytes, err := services.ConvertExcelToPDF(excelBytes, filenamePrefix+".xlsx")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert spreadsheet to PDF: " + err.Error()})
			return
		}

		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.pdf", filenamePrefix))
		c.Header("Content-Type", "application/pdf")
		c.Data(http.StatusOK, "application/pdf", pdfBytes)
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported response format"})
}

// GetHolidaysHandler retrieves Indonesian holidays filtered by year and month
// @Summary Get Indonesia public holidays
// @Description Get public holidays in Indonesia for a specific year and month.
// @Accept json
// @Produce json
// @Param year query int false "Year"
// @Param month query int false "Month"
// @Success 200 {array} models.Holiday
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/holidays [get]
func GetHolidaysHandler(c *gin.Context) {
	yearStr := c.Query("year")
	monthStr := c.Query("month")

	year, _ := strconv.Atoi(yearStr)
	month, _ := strconv.Atoi(monthStr)

	if year == 0 {
		year = time.Now().Year()
	}
	if month == 0 {
		month = int(time.Now().Month())
	}

	h, err := services.FetchHolidays(year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch holidays: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, h)
}
