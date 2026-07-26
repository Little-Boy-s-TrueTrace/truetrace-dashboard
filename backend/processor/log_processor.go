package processor

import (
	"log"
)

// ProcessComplianceEvent handles incoming compliance events from the backend.
// In the TrueTrace architecture, the Spring Boot backend handles KYC/AML/STR
// event processing, so this is a minimal stub for the Go dashboard layer.
func ProcessComplianceEvent(eventType string, payload []byte) {
	log.Printf("[PROCESSOR] Received compliance event type=%s, payload_size=%d", eventType, len(payload))
}
