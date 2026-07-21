package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"

	"timesheet-backend/models"
	"timesheet-backend/services"
)

// jakarta returns the Asia/Jakarta location, falling back to a fixed +07:00.
func jakarta() *time.Location {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*3600)
	}
	return loc
}

// dailyActivityRequest is a single day's entry from the daily modal or grid.
type dailyActivityRequest struct {
	Date        string `json:"date" binding:"required"` // YYYY-MM-DD
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Status      string `json:"status"`
	Activity    string `json:"activity"`
	ProjectName string `json:"project_name"`
	ProjectID   string `json:"project_id"`
	AppImpacted string `json:"app_impacted"`
}

// UpsertDailyActivity creates or updates the current user's entry for one day.
func (s *Server) UpsertDailyActivity(c *gin.Context) {
	var req dailyActivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	date, err := time.ParseInLocation("2006-01-02", req.Date, jakarta())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, expected YYYY-MM-DD"})
		return
	}

	activity := models.DailyActivity{
		UserID:      currentUserID(c),
		Date:        date,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Status:      req.Status,
		Activity:    req.Activity,
		ProjectName: req.ProjectName,
		ProjectID:   req.ProjectID,
		AppImpacted: req.AppImpacted,
	}

	// Upsert on the (user_id, date) unique index.
	err = s.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"start_time", "end_time", "status", "activity",
			"project_name", "project_id", "app_impacted", "updated_at",
		}),
	}).Create(&activity).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, activity)
}

// ListMonthlyActivities returns the current user's entries for a month.
func (s *Server) ListMonthlyActivities(c *gin.Context) {
	year := queryIntDefault(c, "year", time.Now().In(jakarta()).Year())
	month := queryIntDefault(c, "month", int(time.Now().In(jakarta()).Month()))

	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, jakarta())
	end := start.AddDate(0, 1, 0)

	var activities []models.DailyActivity
	if err := s.DB.Where("user_id = ? AND date >= ? AND date < ?", currentUserID(c), start, end).
		Order("date asc").Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, activities)
}

// generateRequest selects the template, month and year to render.
type generateRequest struct {
	TemplateID uint `json:"template_id"`
	Month      int  `json:"month" binding:"required,min=1,max=12"`
	Year       int  `json:"year" binding:"required,min=2000,max=9999"`
}

// GenerateTimesheet renders the user's month into the mapped template, streams
// the .xlsx back for download, and emails a copy to the user (requirement 5).
func (s *Server) GenerateTimesheet(c *gin.Context) {
	var req generateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := s.DB.First(&user, currentUserID(c)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Resolve the template: explicit id, else the default.
	var tmpl models.Template
	q := s.DB.Preload("CellMappings")
	if req.TemplateID != 0 {
		q = q.Where("id = ?", req.TemplateID)
	} else {
		q = q.Where("is_default = ?", true)
	}
	if err := q.First(&tmpl).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no template available; ask an admin to upload one"})
		return
	}

	start := time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, jakarta())
	end := start.AddDate(0, 1, 0)
	var activities []models.DailyActivity
	s.DB.Where("user_id = ? AND date >= ? AND date < ?", user.ID, start, end).Find(&activities)

	out, err := services.GenerateFromTemplate(services.GenerationInput{
		Template:   &tmpl,
		Mappings:   tmpl.CellMappings,
		User:       &user,
		Month:      req.Month,
		Year:       req.Year,
		Activities: activities,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "generation failed: " + err.Error()})
		return
	}

	filename := fmt.Sprintf("Timesheet_%s_%02d_%04d.xlsx", sanitize(user.Username), req.Month, req.Year)

	// Email a copy asynchronously so the download isn't blocked on SMTP.
	go func(to, fn string, data []byte) {
		_ = s.Mailer.SendTimesheetEmail(to, fn, data)
	}(user.Email, filename, out)

	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out)
}

func queryIntDefault(c *gin.Context, key string, def int) int {
	if v := c.Query(key); v != "" {
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil {
			return n
		}
	}
	return def
}

func sanitize(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			out = append(out, r)
		}
	}
	return string(out)
}
