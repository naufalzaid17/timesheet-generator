package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/swaggo/files"
	"github.com/swaggo/gin-swagger"

	"timesheet-backend/handlers"
	_ "timesheet-backend/docs" // Import generated docs for swagger
)

// @title Timesheet Automation API
// @version 1.0
// @description Production-ready API for generating and converting monthly timesheets.
// @host localhost:8080
// @BasePath /

func main() {
	r := gin.Default()

	// Enable CORS
	r.Use(handlers.CORSMiddleware())

	// Swagger UI route
	r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Timesheet Generation route
	r.POST("/api/timesheet", handlers.GenerateTimesheetHandler)

	// Get holidays route
	r.GET("/api/holidays", handlers.GetHolidaysHandler)

	// Serve static frontend files
	staticPath := os.Getenv("STATIC_FILES_PATH")
	if staticPath == "" {
		staticPath = "./static"
	}
	if _, err := os.Stat(staticPath); err == nil {
		r.Static("/_next", staticPath+"/_next")
		r.StaticFile("/favicon.ico", staticPath+"/favicon.ico")
		r.StaticFile("/", staticPath+"/index.html")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
