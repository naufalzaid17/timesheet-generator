package database

import (
	"crypto/rand"
	"encoding/base64"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"timesheet-backend/assets"
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
	if err := seedDefaultTemplate(db); err != nil {
		// Non-fatal: the portal still runs, admins can upload a template.
		log.Printf("[database] could not seed default template: %v", err)
	}
	return db, nil
}

// seedDefaultTemplate installs the bundled BNI DEV timesheet as the default
// template on first boot (when no template exists yet), along with a
// representative cell mapping so the admin builder reflects its structure.
// Generation for this template uses a dedicated strict-typed path keyed off
// Template.Builtin.
func seedDefaultTemplate(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.Template{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	if len(assets.BNITemplate) == 0 {
		return nil
	}

	tmpl := models.Template{
		Name:        "BNI DEV Timesheet",
		Description: "Built-in default timesheet template (strict date/time typing + status matrix).",
		SheetName:   "Sheet1",
		FileData:    assets.BNITemplate,
		IsDefault:   true,
		Builtin:     "bni_dev",
		CellMappings: []models.CellMapping{
			// Header metadata (column C, rows 1-6).
			{Field: models.FieldMetaDivision, Scope: models.ScopeCell, CellRef: "C2", Fillable: false},
			{Field: models.FieldMetaName, Scope: models.ScopeCell, CellRef: "C3", Fillable: false},
			{Field: models.FieldMetaMiiID, Scope: models.ScopeCell, CellRef: "C4", Fillable: false},
			{Field: models.FieldMetaSite, Scope: models.ScopeCell, CellRef: "C5", Fillable: false},
			{Field: models.FieldMetaMonth, Scope: models.ScopeCell, CellRef: "C6", Fillable: false},
			// Daily columns, anchored at row 9 (day 1).
			{Field: models.FieldDate, Scope: models.ScopeDailyColumn, Column: "A", StartRow: 9, Fillable: false},
			{Field: models.FieldTimeIn, Scope: models.ScopeDailyColumn, Column: "B", StartRow: 9, Fillable: true},
			{Field: models.FieldTimeOut, Scope: models.ScopeDailyColumn, Column: "C", StartRow: 9, Fillable: true},
			{Field: models.FieldStatus, Scope: models.ScopeDailyColumn, Column: "E", StartRow: 9, Fillable: true},
			{Field: models.FieldActivity, Scope: models.ScopeDailyColumn, Column: "K", StartRow: 9, Fillable: true},
			{Field: models.FieldProjectName, Scope: models.ScopeDailyColumn, Column: "L", StartRow: 9, Fillable: true},
			{Field: models.FieldProjectID, Scope: models.ScopeDailyColumn, Column: "M", StartRow: 9, Fillable: true},
			{Field: models.FieldAppImpacted, Scope: models.ScopeDailyColumn, Column: "N", StartRow: 9, Fillable: true},
		},
	}
	if err := db.Create(&tmpl).Error; err != nil {
		return err
	}
	log.Printf("[database] seeded default template '%s' (builtin bni_dev)", tmpl.Name)
	return nil
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
