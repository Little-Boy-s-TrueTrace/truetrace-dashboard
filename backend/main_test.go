package main

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"dashboard/backend/handlers"
)

func TestRouterPreservesComplianceActionSuffixesAndBodies(t *testing.T) {
	tests := []struct {
		method   string
		path     string
		body     string
		wantPath string
	}{
		{http.MethodPost, "/api/kyc/kyc-1/approve", "", "/api/kyc/sessions/kyc-1/approve"},
		{http.MethodPost, "/api/kyc/kyc-1/reject", "", "/api/kyc/sessions/kyc-1/reject"},
		{http.MethodPost, "/api/aml/alert-1/escalate", "", "/api/aml/alerts/alert-1/escalate"},
		{http.MethodPost, "/api/aml/alert-1/close", "", "/api/aml/alerts/alert-1/close"},
		{http.MethodPut, "/api/str/str-1/status", `{"status":"READY_FOR_REVIEW"}`, "/api/str/reports/str-1/status"},
		{http.MethodPost, "/api/str/str-1/submit", "", "/api/str/reports/str-1/submit"},
	}

	for _, test := range tests {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			var gotMethod, gotPath, gotBody string
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotMethod = r.Method
				gotPath = r.URL.Path
				body, _ := io.ReadAll(r.Body)
				gotBody = string(body)
				w.WriteHeader(http.StatusNoContent)
			}))
			defer upstream.Close()

			oldURL := handlers.BackendURL
			handlers.BackendURL = upstream.URL
			defer func() { handlers.BackendURL = oldURL }()

			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(test.body))
			recorder := httptest.NewRecorder()
			newMux().ServeHTTP(recorder, request)

			if recorder.Code != http.StatusNoContent {
				t.Fatalf("expected 204, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if gotMethod != test.method || gotPath != test.wantPath || gotBody != test.body {
				t.Fatalf(
					"router lost action contract: got method=%s path=%s body=%q",
					gotMethod,
					gotPath,
					gotBody,
				)
			}
		})
	}
}
