package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type proxyCapture struct {
	method        string
	path          string
	query         string
	body          string
	internalToken string
}

func withBackend(t *testing.T, responder http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(responder)
	oldURL := BackendURL
	oldToken := BackendInternalToken
	oldClient := backendHTTPClient
	BackendURL = server.URL
	BackendInternalToken = "integration-test-token"
	backendHTTPClient = server.Client()
	t.Cleanup(func() {
		server.Close()
		BackendURL = oldURL
		BackendInternalToken = oldToken
		backendHTTPClient = oldClient
	})
}

func captureRequest(r *http.Request) proxyCapture {
	body, _ := io.ReadAll(r.Body)
	return proxyCapture{
		method:        r.Method,
		path:          r.URL.Path,
		query:         r.URL.RawQuery,
		body:          string(body),
		internalToken: r.Header.Get("X-TrueTrace-Internal-Token"),
	}
}

func TestComplianceListsProxySpringSourceOfTruth(t *testing.T) {
	tests := []struct {
		name     string
		request  string
		wantPath string
		handler  http.HandlerFunc
	}{
		{"KYC", "/api/kyc?status=APPROVED", "/api/kyc/sessions", GetKycSessions},
		{"AML", "/api/aml?status=OPEN", "/api/aml/alerts", GetAmlAlerts},
		{"STR", "/api/str?status=DRAFT", "/api/str/reports", GetStrReports},
		{"stats", "/api/compliance/stats", "/api/compliance/stats", GetComplianceStats},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var got proxyCapture
			withBackend(t, func(w http.ResponseWriter, r *http.Request) {
				got = captureRequest(r)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`[{"source":"spring-postgres"}]`))
			})

			request := httptest.NewRequest(http.MethodGet, test.request, nil)
			recorder := httptest.NewRecorder()
			test.handler(recorder, request)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if got.method != http.MethodGet || got.path != test.wantPath {
				t.Fatalf("unexpected upstream request: %+v", got)
			}
			if got.query != request.URL.RawQuery {
				t.Fatalf("query was not preserved: got %q want %q", got.query, request.URL.RawQuery)
			}
			if got.internalToken != "integration-test-token" {
				t.Fatalf("internal token not forwarded: %+v", got)
			}
			if recorder.Body.String() != `[{"source":"spring-postgres"}]` {
				t.Fatalf("upstream body not preserved: %q", recorder.Body.String())
			}
		})
	}
}

func TestAgentStatusesCombinePersistedCountsWithRuntimeHealth(t *testing.T) {
	var statusRequest proxyCapture
	withBackend(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"ok"}`))
			return
		}
		statusRequest = captureRequest(r)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{
			"agentId":"money-trail",
			"agentName":"Transactions Graph Explorer",
			"status":"UNKNOWN",
			"processedCount":9,
			"lastActivity":"2026-07-30T00:00:00"
		}]`))
	})
	oldAgentEngineURL := AgentEngineURL
	AgentEngineURL = BackendURL
	t.Cleanup(func() { AgentEngineURL = oldAgentEngineURL })

	request := httptest.NewRequest(http.MethodGet, "/api/agents/status", nil)
	request.Header.Set("X-TrueTrace-Operator", "compliance.operator")
	recorder := httptest.NewRecorder()

	GetAgentStatuses(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if statusRequest.path != "/api/agents/status" ||
		statusRequest.internalToken != "integration-test-token" {
		t.Fatalf("unexpected persisted-status request: %+v", statusRequest)
	}
	var payload []map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid response: %v", err)
	}
	if len(payload) != 1 ||
		payload[0]["status"] != "RUNNING" ||
		payload[0]["healthSource"] != "agent-engine /health" ||
		payload[0]["processedCount"] != float64(9) {
		t.Fatalf("unexpected combined status: %+v", payload)
	}
}

func TestComplianceActionsPreserveMethodPathAndBody(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		path     string
		body     string
		wantPath string
		handler  http.HandlerFunc
	}{
		{"approve KYC", http.MethodPost, "/api/kyc/kyc-123/approve", "", "/api/kyc/sessions/kyc-123/approve", GetKycSessionDetail},
		{"reject KYC", http.MethodPost, "/api/kyc/kyc-123/reject", "", "/api/kyc/sessions/kyc-123/reject", GetKycSessionDetail},
		{"update KYC", http.MethodPut, "/api/kyc/kyc-123/status", `{"status":"MANUAL_REVIEW"}`, "/api/kyc/sessions/kyc-123/status", GetKycSessionDetail},
		{"escalate alert", http.MethodPost, "/api/aml/alert-123/escalate", "", "/api/aml/alerts/alert-123/escalate", GetAmlAlertDetail},
		{"close alert", http.MethodPost, "/api/aml/alert-123/close", "", "/api/aml/alerts/alert-123/close", GetAmlAlertDetail},
		{"update alert", http.MethodPut, "/api/aml/alert-123/status", `{"status":"INVESTIGATING"}`, "/api/aml/alerts/alert-123/status", GetAmlAlertDetail},
		{"freeze account", http.MethodPost, "/api/aml/freeze/1000000001", "", "/api/aml/freeze/1000000001", GetAmlAlertDetail},
		{"unfreeze account", http.MethodPost, "/api/aml/unfreeze/1000000001", "", "/api/aml/unfreeze/1000000001", GetAmlAlertDetail},
		{"review STR", http.MethodPut, "/api/str/str-123/status", `{"status":"READY_FOR_REVIEW"}`, "/api/str/reports/str-123/status", GetStrReportDetail},
		{"submit STR", http.MethodPost, "/api/str/str-123/submit", "", "/api/str/reports/str-123/submit", GetStrReportDetail},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var got proxyCapture
			withBackend(t, func(w http.ResponseWriter, r *http.Request) {
				got = captureRequest(r)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusAccepted)
				_, _ = w.Write([]byte(`{"persisted":true}`))
			})

			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(test.body))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			test.handler(recorder, request)

			if recorder.Code != http.StatusAccepted {
				t.Fatalf("expected upstream status 202, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if got.method != test.method || got.path != test.wantPath || got.body != test.body {
				t.Fatalf("method/path/body not preserved: got %+v", got)
			}
			if recorder.Body.String() != `{"persisted":true}` {
				t.Fatalf("upstream response body not preserved: %q", recorder.Body.String())
			}
		})
	}
}

func TestGetAmlAlertGraphUsesSpringAlertGraphData(t *testing.T) {
	var gotPath string
	withBackend(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"alertId":"alert-9","graphData":{"nodes":[{"id":"mule"}],"edges":[]}}`))
	})

	request := httptest.NewRequest(http.MethodGet, "/api/aml/alert-9/graph", nil)
	recorder := httptest.NewRecorder()
	GetAmlAlertGraph(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if gotPath != "/api/aml/alerts/alert-9" {
		t.Fatalf("unexpected path %s", gotPath)
	}
	if recorder.Body.String() != `{"nodes":[{"id":"mule"}],"edges":[]}` {
		t.Fatalf("unexpected graph body %q", recorder.Body.String())
	}
}

func TestInvalidCompliancePathsReturnBadRequest(t *testing.T) {
	tests := []struct {
		handler http.HandlerFunc
		path    string
	}{
		{GetKycSessionDetail, "/api/kyc/"},
		{GetAmlAlertDetail, "/api/aml/"},
		{GetAmlAlertGraph, "/api/aml/alert-1"},
		{GetStrReportDetail, "/api/str/"},
	}
	for _, test := range tests {
		recorder := httptest.NewRecorder()
		test.handler(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400, got %d", test.path, recorder.Code)
		}
	}
}

func TestProxyReturnsBadGatewayWhenSpringIsUnavailable(t *testing.T) {
	oldURL := BackendURL
	oldClient := backendHTTPClient
	BackendURL = "http://127.0.0.1:1"
	backendHTTPClient = &http.Client{}
	t.Cleanup(func() {
		BackendURL = oldURL
		backendHTTPClient = oldClient
	})

	recorder := httptest.NewRecorder()
	GetComplianceStats(recorder, httptest.NewRequest(http.MethodGet, "/api/compliance/stats", nil))
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", recorder.Code)
	}
}

func TestWriteJSON(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeJSON(recorder, http.StatusOK, map[string]string{"status": "ok"})
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected application/json, got %q", got)
	}
}
