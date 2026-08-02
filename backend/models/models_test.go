package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestModelsJSONSerialization(t *testing.T) {
	now := time.Now()
	
	kyc := KycSession{
		ID:            1,
		SessionID:     "SESS-100",
		CustomerID:    "CUST-001",
		CustomerName:  "Nguyen Van A",
		Status:        "APPROVED",
		DeepfakeScore: 0.12,
		CCCDNumber:    "001099123456",
		CCCDValid:     true,
		RiskLevel:     "LOW",
		CreatedAt:     now,
	}

	data, err := json.Marshal(kyc)
	if err != nil {
		t.Fatalf("Failed to marshal KycSession: %v", err)
	}

	var unmarshaled KycSession
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal KycSession: %v", err)
	}

	if unmarshaled.SessionID != kyc.SessionID || unmarshaled.CCCDNumber != kyc.CCCDNumber {
		t.Errorf("Mismatch after unmarshal: got %v, want %v", unmarshaled, kyc)
	}
}
