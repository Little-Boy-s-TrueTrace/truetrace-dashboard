package store

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var (
	SQL         *sql.DB
	UsePostgres bool = false
)

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := os.Getenv("DB_HOST")
		user := os.Getenv("DB_USER")
		pass := os.Getenv("DB_PASSWORD")
		name := os.Getenv("DB_NAME")
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5432"
		}
		if host != "" && user != "" && name != "" {
			dsn = "host=" + host + " port=" + port + " user=" + user + " password='" + pass + "' dbname=" + name + " sslmode=disable"
		} else {
			dsn = "host=localhost port=5432 user=postgres password='change_me_in_production' dbname=truetrace sslmode=disable"
		}
	}

	log.Printf("[DATABASE] Attempting connection to PostgreSQL...")
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[DATABASE WARNING] Failed to initialize PostgreSQL driver: %v. Falling back to In-Memory mode.", err)
		UsePostgres = false
		return
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	err = db.Ping()
	if err != nil {
		log.Printf("[DATABASE WARNING] PostgreSQL is offline or unreachable: %v. Falling back to In-Memory mode.", err)
		UsePostgres = false
		return
	}

	if err := ensureAuthSchema(db); err != nil {
		log.Printf("[DATABASE WARNING] Failed to initialize dashboard auth schema: %v. Falling back to In-Memory mode.", err)
		_ = db.Close()
		UsePostgres = false
		return
	}

	SQL = db
	UsePostgres = true
	log.Printf("[DATABASE] Connected to PostgreSQL successfully!")
}

func ensureAuthSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS operators (
			uid VARCHAR(32) PRIMARY KEY,
			username VARCHAR(255) NOT NULL UNIQUE
		)`,
		`CREATE TABLE IF NOT EXISTS otps (
			uid VARCHAR(32) PRIMARY KEY REFERENCES operators(uid) ON DELETE CASCADE,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			session_token VARCHAR(255) PRIMARY KEY,
			uid VARCHAR(32) NOT NULL REFERENCES operators(uid) ON DELETE CASCADE,
			username VARCHAR(255) NOT NULL,
			ip_address VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires_at ON sessions(expires_at)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	operators, err := configuredOperators()
	if err != nil {
		return err
	}
	for uid, username := range operators {
		if _, err := db.Exec(
			`INSERT INTO operators(uid, username) VALUES($1, $2)
			 ON CONFLICT (uid) DO UPDATE SET username = EXCLUDED.username`,
			uid,
			username,
		); err != nil {
			return err
		}
	}
	return nil
}

func configuredOperators() (map[string]string, error) {
	raw := strings.TrimSpace(os.Getenv("TRUETRACE_DASHBOARD_OPERATORS"))
	if raw == "" {
		raw = "10001:admin,10002:sarah,10003:alex"
	}
	operators := make(map[string]string)
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.SplitN(strings.TrimSpace(entry), ":", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			return nil, fmt.Errorf("invalid TRUETRACE_DASHBOARD_OPERATORS entry %q", entry)
		}
		operators[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}
	return operators, nil
}

// SQL Session Store Helpers
func SaveSQLSession(sessionToken string, uid string, username string, ipAddress string, expiresAt time.Time) error {
	_, err := SQL.Exec(`
		INSERT INTO sessions(session_token, uid, username, ip_address, expires_at) 
		VALUES($1, $2, $3, $4, $5)
	`, sessionToken, uid, username, ipAddress, expiresAt)
	return err
}

func GetSQLSession(sessionToken string) (string, string, string, time.Time, error) {
	var uid string
	var username string
	var ipAddress string
	var expiresAt time.Time
	err := SQL.QueryRow("SELECT uid, username, ip_address, expires_at FROM sessions WHERE session_token = $1", sessionToken).Scan(&uid, &username, &ipAddress, &expiresAt)
	return uid, username, ipAddress, expiresAt, err
}

func DeleteSQLSession(sessionToken string) error {
	_, err := SQL.Exec("DELETE FROM sessions WHERE session_token = $1", sessionToken)
	return err
}

func CleanExpiredSQLSessions() {
	if !UsePostgres {
		return
	}
	_, err := SQL.Exec("DELETE FROM sessions WHERE expires_at < $1", time.Now())
	if err != nil {
		log.Printf("[DATABASE ERROR] Failed to clean expired sessions: %v", err)
	}
}

func SaveSQLOTP(uid string, token string, expiresAt time.Time) error {
	_, err := SQL.Exec(`
		INSERT INTO otps(uid, token_hash, expires_at) 
		VALUES($1, $2, $3)
		ON CONFLICT (uid) DO UPDATE 
		SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at
	`, uid, token, expiresAt)
	return err
}

func GetSQLOTP(uid string) (string, time.Time, error) {
	var token string
	var expiresAt time.Time
	err := SQL.QueryRow("SELECT token_hash, expires_at FROM otps WHERE uid = $1", uid).Scan(&token, &expiresAt)
	return token, expiresAt, err
}

func DeleteSQLOTP(uid string) error {
	_, err := SQL.Exec("DELETE FROM otps WHERE uid = $1", uid)
	return err
}

func DeleteAllSQLOTPs() error {
	if !UsePostgres {
		return nil
	}
	_, err := SQL.Exec("DELETE FROM otps")
	return err
}
