package store

import (
	"testing"
)

func TestSeedDemoData(t *testing.T) {
	if len(DB.AgentStatuses) != 3 {
		t.Errorf("Expected 3 agents, got %d", len(DB.AgentStatuses))
	}

	if len(DB.KycSessions) != 1 {
		t.Errorf("Expected 1 KycSession, got %d", len(DB.KycSessions))
	}
}
