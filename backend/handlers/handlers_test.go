package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetKycSessions(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/kyc", nil)
	w := httptest.NewRecorder()

	GetKycSessions(w, req)

	// Returns 502 since the backend is not running during tests
	// This validates the handler exists and runs without panic
	if w.Code != http.StatusBadGateway {
		t.Errorf("Expected status 502 (backend not available), got %d", w.Code)
	}
}

func TestGetKycSessionDetail(t *testing.T) {
	t.Run("Valid path", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/kyc/session-001", nil)
		w := httptest.NewRecorder()
		GetKycSessionDetail(w, req)
		if w.Code != http.StatusBadGateway {
			t.Errorf("Expected status 502, got %d", w.Code)
		}
	})

	t.Run("Invalid path (too short)", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api", nil)
		w := httptest.NewRecorder()
		GetKycSessionDetail(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", w.Code)
		}
	})
}

func TestGetAmlAlerts(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/aml", nil)
	w := httptest.NewRecorder()
	GetAmlAlerts(w, req)
	if w.Code != http.StatusBadGateway {
		t.Errorf("Expected status 502, got %d", w.Code)
	}
}

func TestGetAmlAlertDetail(t *testing.T) {
	t.Run("Valid path", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/aml/alert-001", nil)
		w := httptest.NewRecorder()
		GetAmlAlertDetail(w, req)
		if w.Code != http.StatusBadGateway {
			t.Errorf("Expected status 502, got %d", w.Code)
		}
	})

	t.Run("Invalid path", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api", nil)
		w := httptest.NewRecorder()
		GetAmlAlertDetail(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", w.Code)
		}
	})
}

func TestGetStrReports(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/str", nil)
	w := httptest.NewRecorder()
	GetStrReports(w, req)
	if w.Code != http.StatusBadGateway {
		t.Errorf("Expected status 502, got %d", w.Code)
	}
}

func TestGetComplianceStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/compliance/stats", nil)
	w := httptest.NewRecorder()
	GetComplianceStats(w, req)
	if w.Code != http.StatusBadGateway {
		t.Errorf("Expected status 502, got %d", w.Code)
	}
}

func TestGetAgentStatuses(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/agents/status", nil)
	w := httptest.NewRecorder()
	GetAgentStatuses(w, req)
	if w.Code != http.StatusBadGateway {
		t.Errorf("Expected status 502, got %d", w.Code)
	}
}

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", ct)
	}
}
