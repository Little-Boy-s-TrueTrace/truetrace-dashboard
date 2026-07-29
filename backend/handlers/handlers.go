package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"dashboard/backend/store"
)

var BackendURL = "http://localhost:8080" // default, can be overridden by env var
var BackendInternalToken string

func init() {
	if url := os.Getenv("BACKEND_URL"); url != "" {
		BackendURL = url
	}
	BackendInternalToken = os.Getenv("TRUETRACE_SECURITY_SYNC_TOKEN")
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
	if BackendInternalToken != "" {
		req.Header.Set("X-TrueTrace-Internal-Token", BackendInternalToken)
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
	alerts := store.DB.GetAmlAlerts()
	writeJSON(w, http.StatusOK, alerts)
}

func GetAmlAlertDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	for _, alert := range store.DB.GetAmlAlerts() {
		if alert.AlertID == id {
			writeJSON(w, http.StatusOK, alert)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Alert not found"})
}

func GetAmlAlertGraph(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	for _, alert := range store.DB.GetAmlAlerts() {
		if alert.AlertID == id {
			writeJSON(w, http.StatusOK, alert.GraphData)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "Alert graph not found"})
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
	stats := store.DB.GetComplianceStats()
	writeJSON(w, http.StatusOK, stats)
}

func GetAgentStatuses(w http.ResponseWriter, r *http.Request) {
	agents := store.DB.GetAgentStatuses()
	writeJSON(w, http.StatusOK, agents)
}

func GetAgentLogs(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	// Return simulated logs for the agent
	logs := []string{
		fmt.Sprintf("[%s] Agent initialized...", time.Now().Add(-10*time.Minute).Format(time.RFC3339)),
		fmt.Sprintf("[%s] Connecting to datastore...", time.Now().Add(-9*time.Minute).Format(time.RFC3339)),
		fmt.Sprintf("[%s] Processing queue (0 items)...", time.Now().Add(-5*time.Minute).Format(time.RFC3339)),
		fmt.Sprintf("[%s] Status OK for agent %s.", time.Now().Format(time.RFC3339), id),
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"logs": logs})
}

func RestartAgent(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}
	id := parts[3]
	
	store.DB.Mu.Lock()
	if agent, exists := store.DB.AgentStatuses[id]; exists {
		agent.Status = "RESTARTING"
		agent.LastActivity = time.Now()
		// Simulate restart completion asynchronously
		go func(aId string) {
			time.Sleep(2 * time.Second)
			store.DB.Mu.Lock()
			if a, e := store.DB.AgentStatuses[aId]; e {
				a.Status = "RUNNING"
				a.LastActivity = time.Now()
			}
			store.DB.Mu.Unlock()
		}(id)
	}
	store.DB.Mu.Unlock()
	
	writeJSON(w, http.StatusOK, map[string]string{"message": "Restart command issued"})
}
