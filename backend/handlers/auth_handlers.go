package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"timesheet-backend/auth"
	"timesheet-backend/models"
)

// loginRequest is the username/email + password payload.
type loginRequest struct {
	Identifier string `json:"identifier" binding:"required"` // username or email
	Password   string `json:"password" binding:"required"`
}

// Login authenticates with username/email + password and returns a JWT.
func (s *Server) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var user models.User
	err := s.DB.Where("username = ? OR email = ?", req.Identifier, req.Identifier).First(&user).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "account is disabled"})
		return
	}
	if user.PasswordHash == "" || !auth.CheckPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := s.Auth.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

// Me returns the currently authenticated user record.
func (s *Server) Me(c *gin.Context) {
	var user models.User
	if err := s.DB.First(&user, currentUserID(c)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// forgotRequest triggers a reset email.
type forgotRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ForgotPassword issues a reset token and emails a reset link. To avoid user
// enumeration it always returns 200 regardless of whether the email exists.
func (s *Server) ForgotPassword(c *gin.Context) {
	var req forgotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var user models.User
	if err := s.DB.Where("email = ?", req.Email).First(&user).Error; err == nil {
		raw, hash, err := auth.GenerateResetToken()
		if err == nil {
			s.DB.Create(&models.PasswordResetToken{
				UserID:    user.ID,
				TokenHash: hash,
				ExpiresAt: time.Now().Add(s.Cfg.ResetTokenTTL),
			})
			link := s.Cfg.FrontendURL + "/reset-password?token=" + raw
			_ = s.Mailer.SendResetEmail(user.Email, link)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "if the email exists, a reset link has been sent"})
}

// resetRequest completes a password reset.
type resetRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

// ResetPassword validates a reset token and sets a new password.
func (s *Server) ResetPassword(c *gin.Context) {
	var req resetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var token models.PasswordResetToken
	err := s.DB.Where("token_hash = ? AND used = ? AND expires_at > ?", auth.HashToken(req.Token), false, time.Now()).First(&token).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired token"})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	s.DB.Model(&models.User{}).Where("id = ?", token.UserID).Update("password_hash", hash)
	s.DB.Model(&token).Update("used", true)

	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}

// --- WebAuthn: registering a passkey (authenticated) ---

// BeginPasskeyRegistration starts a passkey registration ceremony for the
// currently authenticated user.
func (s *Server) BeginPasskeyRegistration(c *gin.Context) {
	var user models.User
	if err := s.DB.Preload("Credentials").First(&user, currentUserID(c)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	options, sessionData, err := s.WebAuthn.BeginRegistration(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sid := uuid.NewString()
	s.putSession(sid, sessionData)
	c.JSON(http.StatusOK, gin.H{"session_id": sid, "options": options})
}

// FinishPasskeyRegistration completes and stores a new passkey credential.
func (s *Server) FinishPasskeyRegistration(c *gin.Context) {
	sid := c.Query("session_id")
	sessionData, ok := s.takeSession(sid)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown or expired session"})
		return
	}

	var user models.User
	if err := s.DB.Preload("Credentials").First(&user, currentUserID(c)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	credential, err := s.WebAuthn.FinishRegistration(user, *sessionData, c.Request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record := models.NewWebAuthnCredential(user.ID, credential, c.Query("name"))
	if err := s.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save credential"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "passkey registered"})
}

// --- WebAuthn: passwordless login ---

// beginPasskeyLoginRequest carries the username whose passkeys to challenge.
type beginPasskeyLoginRequest struct {
	Identifier string `json:"identifier" binding:"required"`
}

// BeginPasskeyLogin starts an assertion ceremony for a username/email.
func (s *Server) BeginPasskeyLogin(c *gin.Context) {
	var req beginPasskeyLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	var user models.User
	if err := s.DB.Preload("Credentials").Where("username = ? OR email = ?", req.Identifier, req.Identifier).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	options, sessionData, err := s.WebAuthn.BeginLogin(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sid := uuid.NewString()
	s.putSession(sid, sessionData)
	c.JSON(http.StatusOK, gin.H{"session_id": sid, "options": options})
}

// FinishPasskeyLogin validates the assertion and returns a JWT on success.
func (s *Server) FinishPasskeyLogin(c *gin.Context) {
	sid := c.Query("session_id")
	sessionData, ok := s.takeSession(sid)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown or expired session"})
		return
	}

	// The session's user handle identifies the user for the ceremony.
	var user models.User
	if err := s.DB.Preload("Credentials").Where("id = ?", decodeUserHandle(sessionData.UserID)).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	credential, err := s.WebAuthn.FinishLogin(user, *sessionData, c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Persist the updated signature counter for clone detection.
	s.DB.Model(&models.WebAuthnCredential{}).
		Where("credential_id = ?", credential.ID).
		Update("sign_count", credential.Authenticator.SignCount)

	token, err := s.Auth.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

// decodeUserHandle reverses User.WebAuthnID (little-endian uint64 -> id).
func decodeUserHandle(b []byte) uint {
	var id uint
	for i := 0; i < len(b) && i < 8; i++ {
		id |= uint(b[i]) << (8 * i)
	}
	return id
}
