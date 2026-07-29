package main

import (
	"context"
	"dashboard/backend/consumer"
	"dashboard/backend/handlers"
	"dashboard/backend/store"
	"log"
	"net/http"
	"os"
	"strings"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	store.InitStore()
	consumer.StartKafkaConsumer(context.Background())

	mux := newMux()

	// Apply AuthMiddleware then CORS
	handler := corsMiddleware(handlers.AuthMiddleware(mux))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Println("==================================================")
	log.Println("  TrueTrace Compliance Command Center API")
	log.Println("  Server starting on http://localhost:" + port)
	log.Println("==================================================")

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	// Auth Routes (public - handled by auth.go AuthMiddleware bypass list)
	mux.HandleFunc("/api/auth/request-token", handlers.RequestToken)
	mux.HandleFunc("/api/auth/login", handlers.Login)
	mux.HandleFunc("/api/auth/logout", handlers.Logout)
	mux.HandleFunc("/api/auth/check", handlers.CheckAuth)
	mux.HandleFunc("/api/internal/otp/latest", handlers.GetLatestOTP)

	// TrueTrace Compliance Routes
	mux.HandleFunc("/api/kyc", handlers.GetKycSessions)
	mux.HandleFunc("/api/kyc/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/kyc/" {
			handlers.GetKycSessions(w, r)
		} else {
			handlers.GetKycSessionDetail(w, r)
		}
	})

	mux.HandleFunc("/api/aml", handlers.GetAmlAlerts)
	mux.HandleFunc("/api/aml/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/aml/" {
			handlers.GetAmlAlerts(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/graph") {
			handlers.GetAmlAlertGraph(w, r)
		} else {
			handlers.GetAmlAlertDetail(w, r)
		}
	})

	mux.HandleFunc("/api/str", handlers.GetStrReports)
	mux.HandleFunc("/api/str/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/str/" {
			handlers.GetStrReports(w, r)
		} else {
			handlers.GetStrReportDetail(w, r)
		}
	})

	mux.HandleFunc("/api/compliance/stats", handlers.GetComplianceStats)
	mux.HandleFunc("/api/agents/status", handlers.GetAgentStatuses)
	mux.HandleFunc("/api/agents/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/logs") {
			handlers.GetAgentLogs(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/restart") {
			handlers.RestartAgent(w, r)
		} else {
			http.Error(w, `{"error":"Agent endpoint not found"}`, http.StatusNotFound)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	return mux
}
