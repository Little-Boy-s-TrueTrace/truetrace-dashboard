package processor

import (
	"testing"
)

func TestProcessComplianceEvent(t *testing.T) {
	// Ensures ProcessComplianceEvent executes cleanly without panic for empty and valid payloads
	ProcessComplianceEvent("TEST_EVENT", []byte(`{"key": "value"}`))
	ProcessComplianceEvent("EMPTY_EVENT", []byte{})
}
