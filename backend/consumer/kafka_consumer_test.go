package consumer

import (
	"context"
	"testing"

	"github.com/segmentio/kafka-go"
)

func resetTelemetry() {
	telemetry.transactions.Store(0)
	telemetry.kyc.Store(0)
	telemetry.alerts.Store(0)
	telemetry.invalid.Store(0)
}

func TestKafkaHandlersValidateSchemaWithoutCreatingBusinessState(t *testing.T) {
	resetTelemetry()
	ctx := context.Background()

	handleTransactionEvent(ctx, kafka.Message{
		Offset: 1,
		Value: []byte(`{
			"id": 42,
			"sourceAccountNumber": "1000000001",
			"targetAccountNumber": "1000000002",
			"amount": 45000000,
			"timestamp": [2026,7,30,10,0,0],
			"status": "SUCCESS"
		}`),
	})
	handleKycEvent(ctx, kafka.Message{
		Offset: 2,
		Value:  []byte(`{"sessionId":"kyc-dynamic-1","customerId":"customer-1","status":"PENDING"}`),
	})
	handleTransactionEvent(ctx, kafka.Message{
		Offset: 3,
		Value: []byte(`{
			"id": 43,
			"source_account": "1000000003",
			"target_account": "1000000004",
			"amount": 190000000,
			"timestamp": "2026-07-30T10:00:00Z",
			"status": "SUCCESS"
		}`),
	})
	handleKycEvent(ctx, kafka.Message{
		Offset: 4,
		Value:  []byte(`{"session_id":"kyc-real-snake-1","customer_id":"customer-2","customer_name":"Demo User"}`),
	})
	handleAlertEvent(ctx, kafka.Message{
		Offset: 5,
		Value:  []byte(`{"alert_id":"alert-dynamic-1","risk_score":10}`),
	})

	got := SnapshotTelemetry()
	if got.Transactions != 2 || got.KYC != 2 || got.Alerts != 1 || got.Invalid != 0 {
		t.Fatalf("unexpected telemetry snapshot: %+v", got)
	}
}

func TestKafkaHandlersRejectMalformedOrIncompleteEvents(t *testing.T) {
	resetTelemetry()
	ctx := context.Background()

	handleTransactionEvent(ctx, kafka.Message{Offset: 1, Value: []byte(`{"amount": 10}`)})
	handleKycEvent(ctx, kafka.Message{Offset: 2, Value: []byte(`not-json`)})
	handleAlertEvent(ctx, kafka.Message{Offset: 3, Value: []byte(`{}`)})

	got := SnapshotTelemetry()
	if got.Invalid != 3 {
		t.Fatalf("expected three invalid events, got %+v", got)
	}
	if got.Transactions != 0 || got.KYC != 0 || got.Alerts != 0 {
		t.Fatalf("invalid events must not increment valid counters: %+v", got)
	}
}
