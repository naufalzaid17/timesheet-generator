package database

import (
	"crypto/rand"
	"encoding/base64"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"timesheet-backend/config"
	"timesheet-backend/models"
)

// Connect opens the PostgreSQL connection, runs migrations, and seeds the
// bootstrap admin account.
func Connect(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	})
	if err != nil {
		return nil, err
	}

	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	if err := seedAdmin(db, cfg); err != nil {
		return nil, err
	}
	return db, nil
}

// AutoMigrate runs GORM migrations for every entity.
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.WebAuthnCredential{},
		&models.Template{},
		&models.CellMapping{},
		&models.DailyActivity{},
		&models.PushSubscription{},
		&models.ProfileChangeRequest{},
		&models.PasswordResetToken{},
	)
}

// seedAdmin creates the bootstrap admin the first time the portal boots with an
// empty users table. Public sign-up is disabled, so this is the only way an
// initial administrator can come into existence.
func seedAdmin(db *gorm.DB, cfg *config.Config) error {
	var count int64
	if err := db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	// Never seed a known/guessable admin password. When BOOTSTRAP_ADMIN_PASSWORD
	// is not explicitly provided, generate a strong random one and print it once
	// so an operator can capture it from the logs and rotate it.
	adminPassword := cfg.AdminPassword
	generated := false
	if adminPassword == "" {
		adminPassword = randomPassword(18)
		generated = true
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	admin := models.User{
		Username:     cfg.AdminUsername,
		Email:        cfg.AdminEmail,
		PasswordHash: string(hash),
		Role:         models.RoleAdmin,
		IsActive:     true,
		Name:         "Portal Administrator",
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}
	if generated {
		log.Printf("[database] seeded bootstrap admin '%s' (%s) with a GENERATED password: %s", cfg.AdminUsername, cfg.AdminEmail, adminPassword)
		log.Printf("[database] ^ capture this now and change it after first login; it will not be shown again")
	} else {
		log.Printf("[database] seeded bootstrap admin '%s' (%s) using BOOTSTRAP_ADMIN_PASSWORD", cfg.AdminUsername, cfg.AdminEmail)
	}
	return nil
}

// randomPassword returns a URL-safe, cryptographically random password.
func randomPassword(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		// Fall back is unacceptable for a credential; abort startup instead.
		log.Fatalf("[database] failed to generate admin password: %v", err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
