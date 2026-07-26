package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

var BackendURL = "http://localhost:8080" // default, can be overridden by env var

func init() {
	if url := os.Getenv("BACKEND_URL"); url != "" {
		BackendURL = url
	}
}

// Helper to write JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Proxy function to forward requests to the truetrace-backend API
func proxyRequest(w http.ResponseWriter, r *http.Request, path string) {
	targetURL := fmt.Sprintf("%s%s", strings.TrimRight(BackendURL, "/"), path)
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	req, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, r.Body)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create proxy request"})
		return
	}

	// Copy headers
	for k, vv := range r.Header {
		for _, v := range vv {
			req.Header.Add(k, v)
		}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Failed to connect to backend server"})
		return
	}
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)

	io.Copy(w, resp.Body)
}

func GetKycSessions(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/kyc/sessions")
}

func GetKycSessionDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	proxyRequest(w, r, "/api/kyc/sessions/"+id)
}

func GetAmlAlerts(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/aml/alerts")
}

func GetAmlAlertDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	proxyRequest(w, r, "/api/aml/alerts/"+id)
}

func GetAmlAlertGraph(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	proxyRequest(w, r, "/api/aml/alerts/"+id+"/graph")
}

func GetStrReports(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/str/reports")
}

func GetStrReportDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	proxyRequest(w, r, "/api/str/reports/"+id)
}

func GetComplianceStats(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/compliance/stats")
}

func GetAgentStatuses(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/agents/status")
}
