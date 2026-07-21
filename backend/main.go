package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"timesheet-backend/auth"
	"timesheet-backend/config"
	"timesheet-backend/database"
	"timesheet-backend/handlers"
	"timesheet-backend/mailer"
	"timesheet-backend/push"
	"timesheet-backend/scheduler"
)

// @title Timesheet Automation Portal API
// @version 2.0
// @description Phase 2 portal: RBAC, passkeys, dynamic templates, web push, SMTP delivery.
// @BasePath /

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	authSvc := auth.NewService(cfg.JWTSecret, cfg.JWTExpiry)
	mailSvc := mailer.New(cfg)
	pushSvc := push.New(cfg, db)

	srv, err := handlers.NewServer(db, cfg, authSvc, mailSvc, pushSvc)
	if err != nil {
		log.Fatalf("failed to init server: %v", err)
	}

	// Daily 17:00 WIB reminder scheduler.
	sched := scheduler.New(db, pushSvc, cfg.Timezone)
	sched.Start()
	defer sched.Stop()

	r := gin.Default()
	r.Use(handlers.CORSMiddleware())
	r.MaxMultipartMemory = 16 << 20 // 16 MiB template uploads

	registerRoutes(r, srv)

	// Optionally serve the exported Next.js frontend.
	staticPath := os.Getenv("STATIC_FILES_PATH")
	if staticPath == "" {
		staticPath = "./static"
	}
	if _, err := os.Stat(staticPath); err == nil {
		r.Static("/_next", staticPath+"/_next")
		r.StaticFile("/favicon.ico", staticPath+"/favicon.ico")
	}

	log.Printf("server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}

// registerRoutes wires the full Phase 2 API surface.
func registerRoutes(r *gin.Engine, s *handlers.Server) {
	api := r.Group("/api")

	// --- Public auth routes (NO public sign-up) ---
	authGroup := api.Group("/auth")
	{
		authGroup.POST("/login", s.Login)
		authGroup.POST("/forgot-password", s.ForgotPassword)
		authGroup.POST("/reset-password", s.ResetPassword)
		authGroup.POST("/passkey/login/begin", s.BeginPasskeyLogin)
		authGroup.POST("/passkey/login/finish", s.FinishPasskeyLogin)
	}

	// Public VAPID key (needed before the user is subscribed).
	api.GET("/push/vapid-public-key", s.GetVAPIDKey)

	// --- Authenticated routes (any role) ---
	authed := api.Group("")
	authed.Use(s.AuthMiddleware())
	{
		authed.GET("/me", s.Me)
		authed.POST("/profile/change", s.SubmitProfileChange)

		// Passkey registration for the logged-in user.
		authed.POST("/passkey/register/begin", s.BeginPasskeyRegistration)
		authed.POST("/passkey/register/finish", s.FinishPasskeyRegistration)

		// Daily activity entry + monthly view + generation.
		authed.POST("/activities", s.UpsertDailyActivity)
		authed.GET("/activities", s.ListMonthlyActivities)
		authed.POST("/timesheet/generate", s.GenerateTimesheet)

		// Templates are readable by users (to fill the grid), writable by admins.
		authed.GET("/templates", s.ListTemplates)
		authed.GET("/templates/:id/grid", s.GetTemplateGrid)

		// Web push subscription.
		authed.POST("/push/subscribe", s.Subscribe)
		authed.POST("/push/test", s.SendTestPush)
	}

	// --- Admin-only routes ---
	admin := api.Group("/admin")
	admin.Use(s.AuthMiddleware(), s.AdminOnly())
	{
		admin.GET("/users", s.ListUsers)
		admin.POST("/users", s.CreateUser)
		admin.PATCH("/users/:id", s.UpdateUser)
		admin.DELETE("/users/:id", s.DeleteUser)

		admin.GET("/profile-changes", s.ListProfileChanges)
		admin.POST("/profile-changes/:id/review", s.ReviewProfileChange)

		admin.POST("/templates", s.UploadTemplate)
		admin.POST("/templates/:id/mappings", s.SaveTemplateMappings)
		admin.DELETE("/templates/:id", s.DeleteTemplate)
	}
}
