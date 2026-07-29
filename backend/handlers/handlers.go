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

var BackendURL = "http://localhost:8080"
var BackendInternalToken string
var backendHTTPClient = &http.Client{Timeout: 10 * time.Second}

func init() {
	if url := os.Getenv("BACKEND_URL"); url != "" {
		BackendURL = url
	}
	BackendInternalToken = os.Getenv("TRUETRACE_SECURITY_SYNC_TOKEN")
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// proxyRequest keeps the dashboard API as a thin authenticated facade. Spring
// owns all compliance state; the dashboard never creates a second KYC, AML, or
// STR record and forwards the original method, query, body, and content type.
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

	for key, values := range r.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	if BackendInternalToken != "" {
		req.Header.Set("X-TrueTrace-Internal-Token", BackendInternalToken)
	}

	resp, err := backendHTTPClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Failed to connect to backend server"})
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		if isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func isHopByHopHeader(name string) bool {
	switch strings.ToLower(name) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
		"te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func suffixAfter(path, prefix string) (string, bool) {
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}
	suffix := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	return suffix, suffix != ""
}

func GetKycSessions(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/kyc/sessions")
}

// GetKycSessionDetail also forwards approve, reject, and status mutations:
// /api/kyc/{sessionId}/approve -> /api/kyc/sessions/{sessionId}/approve.
func GetKycSessionDetail(w http.ResponseWriter, r *http.Request) {
	suffix, ok := suffixAfter(r.URL.Path, "/api/kyc/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid KYC path"})
		return
	}
	proxyRequest(w, r, "/api/kyc/sessions/"+suffix)
}

func GetAmlAlerts(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/aml/alerts")
}

// GetAmlAlertDetail preserves status/escalate/close action suffixes. Freeze and
// unfreeze are account actions in Spring and intentionally do not use /alerts.
func GetAmlAlertDetail(w http.ResponseWriter, r *http.Request) {
	suffix, ok := suffixAfter(r.URL.Path, "/api/aml/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid AML path"})
		return
	}
	if strings.HasPrefix(suffix, "freeze/") || strings.HasPrefix(suffix, "unfreeze/") {
		proxyRequest(w, r, "/api/aml/"+suffix)
		return
	}
	proxyRequest(w, r, "/api/aml/alerts/"+suffix)
}

// The Spring alert detail is the source of truth and already contains
// graphData. Keep the legacy graph endpoint by extracting that field only.
func GetAmlAlertGraph(w http.ResponseWriter, r *http.Request) {
	suffix, ok := suffixAfter(r.URL.Path, "/api/aml/")
	if !ok || !strings.HasSuffix(suffix, "/graph") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid AML graph path"})
		return
	}
	alertID := strings.TrimSuffix(suffix, "/graph")
	targetURL := fmt.Sprintf("%s/api/aml/alerts/%s", strings.TrimRight(BackendURL, "/"), alertID)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create proxy request"})
		return
	}
	if BackendInternalToken != "" {
		req.Header.Set("X-TrueTrace-Internal-Token", BackendInternalToken)
	}
	resp, err := backendHTTPClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Failed to connect to backend server"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
		return
	}
	var alert struct {
		GraphData json.RawMessage `json:"graphData"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&alert); err != nil || len(alert.GraphData) == 0 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Backend returned invalid alert graph data"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(alert.GraphData)
}

func GetStrReports(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/str/reports")
}

// GetStrReportDetail preserves status and submit actions and forwards bodies.
func GetStrReportDetail(w http.ResponseWriter, r *http.Request) {
	suffix, ok := suffixAfter(r.URL.Path, "/api/str/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid STR path"})
		return
	}
	proxyRequest(w, r, "/api/str/reports/"+suffix)
}

func GetComplianceStats(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/compliance/stats")
}

func GetAgentStatuses(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, "/api/agents/status")
}

// Agent logs/restarts are not simulated. If Spring does not expose the action,
// its real 404/405 response is returned to the dashboard.
func GetAgentLogs(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, r.URL.Path)
}

func RestartAgent(w http.ResponseWriter, r *http.Request) {
	proxyRequest(w, r, r.URL.Path)
}
