package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"timesheet-backend/auth"
	"timesheet-backend/models"
)

// createUserRequest is the admin-only account creation payload.
type createUserRequest struct {
	Username string      `json:"username" binding:"required,min=3,max=64"`
	Email    string      `json:"email" binding:"required,email"`
	Role     models.Role `json:"role" binding:"required,oneof=admin user"`
	Name     string      `json:"name"`
	MiiID    string      `json:"mii_id"`
	Division string      `json:"division"`
	Site     string      `json:"site"`
	// Password is optional; when omitted the user completes setup via email link.
	Password string `json:"password"`
}

// ListUsers returns all users (admin only).
func (s *Server) ListUsers(c *gin.Context) {
	var users []models.User
	if err := s.DB.Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// CreateUser provisions a new account (admin only) and emails a setup link.
// This is the sole registration path — there is no public sign-up.
func (s *Server) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := models.User{
		Username: req.Username,
		Email:    req.Email,
		Role:     req.Role,
		Name:     req.Name,
		MiiID:    req.MiiID,
		Division: req.Division,
		Site:     req.Site,
		IsActive: true,
	}
	if req.Password != "" {
		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}
		user.PasswordHash = hash
	}

	if err := s.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}

	// Issue a setup token so the user can set their own password / passkey.
	raw, hash, err := auth.GenerateResetToken()
	if err == nil {
		s.DB.Create(&models.PasswordResetToken{
			UserID:    user.ID,
			TokenHash: hash,
			ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		})
		link := s.Cfg.FrontendURL + "/reset-password?token=" + raw
		_ = s.Mailer.SendSetupEmail(user.Email, user.Username, link)
	}

	c.JSON(http.StatusCreated, user)
}

// updateUserRequest lets admins toggle role/active state.
type updateUserRequest struct {
	Role     *models.Role `json:"role"`
	IsActive *bool        `json:"is_active"`
	Name     *string      `json:"name"`
	MiiID    *string      `json:"mii_id"`
	Division *string      `json:"division"`
	Site     *string      `json:"site"`
}

// UpdateUser edits a user directly (admin only). Admin edits are applied
// immediately, bypassing the approval flow that governs self-service edits.
func (s *Server) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := s.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.Role != nil {
		updates["role"] = *req.Role
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.MiiID != nil {
		updates["mii_id"] = *req.MiiID
	}
	if req.Division != nil {
		updates["division"] = *req.Division
	}
	if req.Site != nil {
		updates["site"] = *req.Site
	}
	if len(updates) > 0 {
		s.DB.Model(&user).Updates(updates)
	}
	s.DB.First(&user, id)
	c.JSON(http.StatusOK, user)
}

// DeleteUser soft-deletes a user (admin only).
func (s *Server) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if err := s.DB.Delete(&models.User{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}

// --- Profile approval flow ---

// profileChangeRequest is a user's self-service profile edit request.
type profileChangeRequest struct {
	Name     string `json:"name"`
	MiiID    string `json:"mii_id"`
	Division string `json:"division"`
	Site     string `json:"site"`
}

// SubmitProfileChange records a pending profile change for the current user.
// The live profile is not modified until an admin approves the request.
func (s *Server) SubmitProfileChange(c *gin.Context) {
	var req profileChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	change := models.ProfileChangeRequest{
		UserID:   currentUserID(c),
		Status:   models.ProfilePending,
		Name:     req.Name,
		MiiID:    req.MiiID,
		Division: req.Division,
		Site:     req.Site,
	}
	if err := s.DB.Create(&change).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, change)
}

// ListProfileChanges returns pending profile change requests (admin only).
func (s *Server) ListProfileChanges(c *gin.Context) {
	var changes []models.ProfileChangeRequest
	q := s.DB.Preload("User").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&changes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, changes)
}

// ReviewProfileChange approves or rejects a pending profile change (admin only).
// On approval the requested values are copied onto the live user record.
func (s *Server) ReviewProfileChange(c *gin.Context) {
	id := c.Param("id")
	action := c.Query("action") // "approve" or "reject"

	var change models.ProfileChangeRequest
	if err := s.DB.First(&change, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}
	if change.Status != models.ProfilePending {
		c.JSON(http.StatusConflict, gin.H{"error": "request already reviewed"})
		return
	}

	reviewer := currentUserID(c)
	now := time.Now()

	if action == "approve" {
		s.DB.Model(&models.User{}).Where("id = ?", change.UserID).Updates(map[string]interface{}{
			"name":     change.Name,
			"mii_id":   change.MiiID,
			"division": change.Division,
			"site":     change.Site,
		})
		change.Status = models.ProfileApproved
	} else {
		change.Status = "rejected"
	}
	change.ReviewedBy = &reviewer
	change.ReviewedAt = &now
	s.DB.Save(&change)

	c.JSON(http.StatusOK, change)
}
