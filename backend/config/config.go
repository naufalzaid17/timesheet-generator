package config

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config aggregates all runtime configuration, sourced from environment
// variables with sensible development defaults.
type Config struct {
	Port        string
	DatabaseURL string

	JWTSecret     string
	JWTExpiry     time.Duration
	ResetTokenTTL time.Duration

	// WebAuthn relying-party configuration.
	RPDisplayName string
	RPID          string
	RPOrigins     []string

	// SMTP configuration for transactional + delivery email.
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	MailFrom string

	// VAPID keys for Web Push. When empty, a pair is generated at boot and
	// logged so it can be pinned into the environment for production.
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string

	// FrontendURL is used to build links inside emails (setup / reset).
	FrontendURL string

	// Timezone used for the daily reminder scheduler.
	Timezone string

	// Bootstrap admin credentials, applied on first boot when no admin exists.
	AdminEmail    string
	AdminUsername string
	AdminPassword string
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// Load reads configuration from the environment.
func Load() *Config {
	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "host=localhost user=timesheet password=timesheet dbname=timesheet port=5432 sslmode=disable TimeZone=Asia/Jakarta"),

		JWTSecret:     getEnv("JWT_SECRET", ""),
		JWTExpiry:     time.Duration(getEnvInt("JWT_EXPIRY_HOURS", 24)) * time.Hour,
		ResetTokenTTL: time.Duration(getEnvInt("RESET_TOKEN_TTL_MINUTES", 60)) * time.Minute,

		RPDisplayName: getEnv("WEBAUTHN_RP_NAME", "Timesheet Portal"),
		RPID:          getEnv("WEBAUTHN_RP_ID", "localhost"),
		RPOrigins:     []string{getEnv("WEBAUTHN_RP_ORIGIN", "http://localhost:3000")},

		SMTPHost: getEnv("SMTP_HOST", "localhost"),
		SMTPPort: getEnvInt("SMTP_PORT", 1025),
		SMTPUser: getEnv("SMTP_USER", ""),
		SMTPPass: getEnv("SMTP_PASS", ""),
		MailFrom: getEnv("MAIL_FROM", "Timesheet Portal <no-reply@timesheet.local>"),

		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:    getEnv("VAPID_SUBJECT", "mailto:admin@timesheet.local"),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
		Timezone:    getEnv("SCHEDULER_TZ", "Asia/Jakarta"),

		AdminEmail:    getEnv("BOOTSTRAP_ADMIN_EMAIL", "admin@timesheet.local"),
		AdminUsername: getEnv("BOOTSTRAP_ADMIN_USERNAME", "admin"),
		AdminPassword: getEnv("BOOTSTRAP_ADMIN_PASSWORD", ""),
	}

	cfg.validateSecrets()
	return cfg
}

// isRelease reports whether the process is running in Gin's release mode.
func isRelease() bool {
	return strings.EqualFold(os.Getenv("GIN_MODE"), "release")
}

// knownWeakSecrets are values that must never be accepted as a signing key,
// including secrets previously shipped as defaults in this repo.
var knownWeakSecrets = map[string]bool{
	"":                                  true,
	"dev-insecure-change-me":            true,
	"dev-secret-change-me":              true,
	"change-me-to-a-long-random-string": true,
	"changeme":                          true,
	"secret":                            true,
}

// validateSecrets fails closed on a missing or well-known JWT secret in
// production. In development it substitutes a random ephemeral secret so local
// runs still work without shipping a guessable signing key. (The bootstrap
// admin password is handled at seed time, where a random one is generated and
// logged when unset.)
func (c *Config) validateSecrets() {
	if knownWeakSecrets[c.JWTSecret] {
		if isRelease() {
			log.Fatal("[config] JWT_SECRET must be set to a strong, non-default value when GIN_MODE=release")
		}
		c.JWTSecret = randomSecret(32)
		log.Println("[config] JWT_SECRET unset or weak; generated an ephemeral development secret (all tokens invalidate on restart)")
	}
}

// randomSecret returns a hex-encoded cryptographically random string.
func randomSecret(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("[config] failed to generate random secret: %v", err)
	}
	return hex.EncodeToString(b)
}
