package consumer

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"
)

// These envelopes intentionally contain only stable fields needed for
// telemetry. The dashboard never turns Kafka messages into compliance records;
// Spring/PostgreSQL remain the single source of truth.
type TransactionEvent struct {
	ID                       *int64          `json:"id"`
	SourceAccountNumber      string          `json:"sourceAccountNumber"`
	SourceAccount            string          `json:"source_account"`
	SourceAccountNumberSnake string          `json:"source_account_number"`
	TargetAccountNumber      string          `json:"targetAccountNumber"`
	TargetAccount            string          `json:"target_account"`
	TargetAccountNumberSnake string          `json:"target_account_number"`
	Amount                   *float64        `json:"amount"`
	Timestamp                json.RawMessage `json:"timestamp"`
	Status                   string          `json:"status"`
}

type KycEvent struct {
	SessionID         string `json:"sessionId"`
	SessionIDSnake    string `json:"session_id"`
	CustomerID        string `json:"customerId"`
	CustomerIDSnake   string `json:"customer_id"`
	CustomerName      string `json:"customerName"`
	CustomerNameSnake string `json:"customer_name"`
	Status            string `json:"status"`
}

type telemetryCounters struct {
	transactions atomic.Uint64
	kyc          atomic.Uint64
	alerts       atomic.Uint64
	invalid      atomic.Uint64
}

var telemetry telemetryCounters

type TelemetrySnapshot struct {
	Transactions uint64
	KYC          uint64
	Alerts       uint64
	Invalid      uint64
}

func SnapshotTelemetry() TelemetrySnapshot {
	return TelemetrySnapshot{
		Transactions: telemetry.transactions.Load(),
		KYC:          telemetry.kyc.Load(),
		Alerts:       telemetry.alerts.Load(),
		Invalid:      telemetry.invalid.Load(),
	}
}

func getKafkaBootstrap() string {
	bootstrap := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if bootstrap == "" {
		bootstrap = "kafka:29092"
	}
	return bootstrap
}

func StartKafkaConsumer(ctx context.Context) {
	bootstrap := getKafkaBootstrap()
	groupID := "truetrace-dashboard-telemetry"

	topics := []struct {
		topic   string
		handler func(context.Context, kafka.Message)
	}{
		{"truetrace.transactions", handleTransactionEvent},
		{"truetrace.kyc.submissions", handleKycEvent},
		{"truetrace.alerts", handleAlertEvent},
	}

	for _, subscription := range topics {
		go func(topic string, handler func(context.Context, kafka.Message)) {
			for {
				err := consumeTopic(ctx, bootstrap, groupID, topic, handler)
				if ctx.Err() != nil {
					return
				}
				log.Printf("[Kafka Telemetry] %s consumer error: %v. Reconnecting in 5s...", topic, err)
				time.Sleep(5 * time.Second)
			}
		}(subscription.topic, subscription.handler)
	}

	log.Printf("[Kafka Telemetry] Started schema-validation consumers for %d topics on %s", len(topics), bootstrap)
}

func consumeTopic(
	ctx context.Context,
	bootstrap string,
	groupID string,
	topic string,
	handler func(context.Context, kafka.Message),
) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        []string{bootstrap},
		GroupID:        groupID,
		Topic:          topic,
		StartOffset:    kafka.LastOffset,
		CommitInterval: time.Second,
		MaxWait:        3 * time.Second,
	})
	defer reader.Close()

	log.Printf("[Kafka Telemetry] Subscribed to topic: %s", topic)
	for {
		message, err := reader.ReadMessage(ctx)
		if err != nil {
			return err
		}
		handler(ctx, message)
	}
}

func handleTransactionEvent(_ context.Context, msg kafka.Message) {
	var event TransactionEvent
	source := ""
	target := ""
	if err := json.Unmarshal(msg.Value, &event); err == nil {
		source = firstNonEmpty(
			event.SourceAccountNumber,
			event.SourceAccount,
			event.SourceAccountNumberSnake,
		)
		target = firstNonEmpty(
			event.TargetAccountNumber,
			event.TargetAccount,
			event.TargetAccountNumberSnake,
		)
	}
	if source == "" || target == "" || event.Amount == nil {
		telemetry.invalid.Add(1)
		log.Printf("[Kafka Telemetry] Invalid transaction event at offset %d", msg.Offset)
		return
	}
	telemetry.transactions.Add(1)
	log.Printf(
		"[Kafka Telemetry] Transaction schema valid at offset %d: %s -> %s",
		msg.Offset,
		source,
		target,
	)
}

func handleKycEvent(_ context.Context, msg kafka.Message) {
	var event KycEvent
	sessionID := ""
	if err := json.Unmarshal(msg.Value, &event); err == nil {
		sessionID = firstNonEmpty(event.SessionID, event.SessionIDSnake)
	}
	if sessionID == "" {
		telemetry.invalid.Add(1)
		log.Printf("[Kafka Telemetry] Invalid KYC event at offset %d", msg.Offset)
		return
	}
	telemetry.kyc.Add(1)
	log.Printf("[Kafka Telemetry] KYC schema valid at offset %d: session=%s", msg.Offset, sessionID)
}

func handleAlertEvent(_ context.Context, msg kafka.Message) {
	var event map[string]interface{}
	if err := json.Unmarshal(msg.Value, &event); err != nil || len(event) == 0 {
		telemetry.invalid.Add(1)
		log.Printf("[Kafka Telemetry] Invalid AML alert event at offset %d", msg.Offset)
		return
	}
	telemetry.alerts.Add(1)
	log.Printf("[Kafka Telemetry] AML alert schema valid at offset %d", msg.Offset)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
