package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"

	"timesheet-backend/models"
	"timesheet-backend/push"
)

// GetVAPIDKey returns the public application server key for the frontend to
// subscribe with.
func (s *Server) GetVAPIDKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"public_key": s.Push.PublicKey()})
}

// subscribeRequest mirrors the browser PushSubscription JSON shape.
type subscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys"`
}

// Subscribe stores a Web Push subscription for the current user.
func (s *Server) Subscribe(c *gin.Context) {
	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sub := models.PushSubscription{
		UserID:   currentUserID(c),
		Endpoint: req.Endpoint,
		P256dh:   req.Keys.P256dh,
		Auth:     req.Keys.Auth,
	}
	// Idempotent on endpoint: re-subscribing updates the owning user + keys.
	err := s.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "p256dh", "auth"}),
	}).Create(&sub).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "subscribed"})
}

// SendTestPush pushes a test notification to the current user (helps verify the
// service worker wiring without waiting for 17:00 WIB).
func (s *Server) SendTestPush(c *gin.Context) {
	s.Push.SendToUser(currentUserID(c), push.Payload{
		Title: "Timesheet Portal",
		Body:  "Waktunya isi timesheet hari ini!",
		URL:   "/dashboard",
	})
	c.JSON(http.StatusOK, gin.H{"message": "test notification dispatched"})
}
