package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"dashboard/backend/models"
	"dashboard/backend/store"

	"github.com/segmentio/kafka-go"
)

// TransactionEvent matches the Spring Boot Transaction entity JSON format
type TransactionEvent struct {
	ID                  *int64          `json:"id"`
	SourceAccountNumber string          `json:"sourceAccountNumber"`
	TargetAccountNumber string          `json:"targetAccountNumber"`
	Amount              *float64        `json:"amount"`
	Description         string          `json:"description"`
	Timestamp           json.RawMessage `json:"timestamp"`
	Status              string          `json:"status"`
}

// KycEvent matches the Spring Boot KYC submission JSON format
type KycEvent struct {
	SessionID    string  `json:"sessionId"`
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	CCCDNumber   string  `json:"cccdNumber"`
	FrontImage   string  `json:"frontImageBase64,omitempty"`
	BackImage    string  `json:"backImageBase64,omitempty"`
	SelfieImage  string  `json:"selfieImageBase64,omitempty"`
	Status       string  `json:"status"`
	RiskScore    float64 `json:"riskScore"`
}

func getKafkaBootstrap() string {
	bootstrap := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if bootstrap == "" {
		bootstrap = "kafka:29092"
	}
	return bootstrap
}

// StartKafkaConsumer launches goroutines that consume from TrueTrace Kafka topics
func StartKafkaConsumer(ctx context.Context) {
	bootstrap := getKafkaBootstrap()
	groupID := "truetrace-dashboard"

	topics := []struct {
		topic   string
		handler func(ctx context.Context, msg kafka.Message)
	}{
		{"truetrace.transactions", handleTransactionEvent},
		{"truetrace.kyc.submissions", handleKycEvent},
		{"truetrace.alerts", handleAlertEvent},
	}

	for _, t := range topics {
		go func(topic string, handler func(ctx context.Context, msg kafka.Message)) {
			for {
				err := consumeTopic(ctx, bootstrap, groupID, topic, handler)
				if ctx.Err() != nil {
					return
				}
				log.Printf("[Kafka Consumer] %s consumer error: %v. Reconnecting in 5s...", topic, err)
				time.Sleep(5 * time.Second)
			}
		}(t.topic, t.handler)
	}

	log.Printf("[Kafka Consumer] Started consumers for %d topics on %s", len(topics), bootstrap)
}

func consumeTopic(ctx context.Context, bootstrap, groupID, topic string, handler func(ctx context.Context, msg kafka.Message)) error {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        []string{bootstrap},
		GroupID:        groupID,
		Topic:          topic,
		StartOffset:    kafka.LastOffset,
		CommitInterval: 1 * time.Second,
		MaxWait:        3 * time.Second,
	})
	defer reader.Close()

	log.Printf("[Kafka Consumer] Subscribed to topic: %s", topic)

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			return err
		}
		handler(ctx, msg)
	}
}

var (
	velocityMu      sync.Mutex
	velocityTracker = make(map[string][]time.Time)
)

func handleTransactionEvent(ctx context.Context, msg kafka.Message) {
	var tx TransactionEvent
	if err := json.Unmarshal(msg.Value, &tx); err != nil {
		log.Printf("[Kafka Consumer] Failed to parse transaction event: %v", err)
		return
	}

	amount := 0.0
	if tx.Amount != nil {
		amount = *tx.Amount
	}

	txID := fmt.Sprintf("tx-%d", msg.Offset)
	if tx.ID != nil {
		txID = fmt.Sprintf("tx-%d", *tx.ID)
	}

	log.Printf("[Kafka Consumer] Ingested transaction %s: %s -> %s amount=%.2f status=%s",
		txID, tx.SourceAccountNumber, tx.TargetAccountNumber, amount, tx.Status)

	now := time.Now()
	
	// Velocity Tracking
	velocityMu.Lock()
	times := velocityTracker[tx.SourceAccountNumber]
	// Filter times within last 60 seconds
	var recentTimes []time.Time
	for _, t := range times {
		if now.Sub(t) <= 60*time.Second {
			recentTimes = append(recentTimes, t)
		}
	}
	recentTimes = append(recentTimes, now)
	velocityTracker[tx.SourceAccountNumber] = recentTimes
	txCount := len(recentTimes)
	velocityMu.Unlock()

	// Determine risk based on amount thresholds (VND) and velocity
	riskScore := 0.0
	alertType := "STANDARD"
	switch {
	case txCount >= 5: // >= 5 transactions in 60 seconds
		riskScore = 0.90
		alertType = "VELOCITY_ANOMALY"
	case amount >= 1_000_000_000: // >= 1 billion VND
		riskScore = 0.95
		alertType = "RAPID_MOVEMENT"
	case amount >= 500_000_000: // >= 500 million VND
		riskScore = 0.75
		alertType = "STRUCTURING"
	case amount >= 100_000_000: // >= 100 million VND
		riskScore = 0.50
		alertType = "MULE_SPLIT"
	default:
		riskScore = 0.15
		alertType = "STANDARD"
	}

	if alertType == "STANDARD" {
		// Skip creating an alert for standard transfers
		return
	}

	// Create an AML alert entry for SOC visibility
	store.DB.Mu.Lock()
	nextID := len(store.DB.AmlAlerts) + 1
	alertID := fmt.Sprintf("aml-tx-%d", nextID)

	alert := &models.AmlAlert{
		ID:                   nextID,
		AlertID:              alertID,
		TriggerTransactionID: txID,
		PrimaryAccountNumber: tx.SourceAccountNumber,
		AlertType:            alertType,
		Status:               "OPEN",
		RiskScore:            riskScore,
		TotalAmount:          amount,
		Currency:             "VND",
		TimeWindowSeconds:    0,
		InvolvedAccounts: []models.InvolvedAccount{
			{AccountNumber: tx.SourceAccountNumber, Role: "sender", TotalOutflow: amount},
			{AccountNumber: tx.TargetAccountNumber, Role: "receiver", TotalInflow: amount},
		},
		TransactionChain: []models.TransactionChainItem{
			{
				TxID:      txID,
				From:      tx.SourceAccountNumber,
				To:        tx.TargetAccountNumber,
				Amount:    amount,
				Timestamp: now,
				Channel:   "web_portal",
			},
		},
		GraphData: models.GraphData{
			Nodes: []models.GraphNode{
				{ID: tx.SourceAccountNumber, Label: tx.SourceAccountNumber, Type: "account", RiskLevel: "medium"},
				{ID: tx.TargetAccountNumber, Label: tx.TargetAccountNumber, Type: "account", RiskLevel: "low"},
			},
			Edges: []models.GraphEdge{
				{Source: tx.SourceAccountNumber, Target: tx.TargetAccountNumber, Amount: amount, Timestamp: now},
			},
		},
		CreatedAt: now,
	}
	store.DB.AmlAlerts = append(store.DB.AmlAlerts, alert)

	// ComplianceStats are now dynamic, no manual increment needed

	store.DB.Mu.Unlock()

	if store.UsePostgres {
		if err := store.SaveAmlAlert(alert); err != nil {
			log.Printf("[Kafka Consumer] Failed to persist AML alert to DB: %v", err)
		}
	}

	log.Printf("[Kafka Consumer] Created AML alert %s for transaction %s (risk=%.2f type=%s)",
		alertID, txID, riskScore, alertType)
}

func handleKycEvent(ctx context.Context, msg kafka.Message) {
	var kyc KycEvent
	if err := json.Unmarshal(msg.Value, &kyc); err != nil {
		log.Printf("[Kafka Consumer] Failed to parse KYC event: %v", err)
		return
	}

	log.Printf("[Kafka Consumer] Ingested KYC submission: customer=%s session=%s",
		kyc.CustomerName, kyc.SessionID)

	store.DB.Mu.Lock()
	nextID := len(store.DB.KycSessions) + 1
	session := &models.KycSession{
		ID:                nextID,
		SessionID:         kyc.SessionID,
		CustomerID:        kyc.CustomerID,
		CustomerName:      kyc.CustomerName,
		Status:            "MANUAL_REVIEW",
		CCCDNumber:        kyc.CCCDNumber,
		CCCDValid:         false,
		RiskLevel:         "pending",
		RecommendedAction: "manual_review",
		CreatedAt:         time.Now(),
	}
	store.DB.KycSessions = append(store.DB.KycSessions, session)
	// We no longer manually update ComplianceStats here since it's dynamic
	store.DB.Mu.Unlock()

	if store.UsePostgres {
		if err := store.SaveKycSession(session); err != nil {
			log.Printf("[Kafka Consumer] Failed to persist KYC session to DB: %v", err)
		}
	}

	log.Printf("[Kafka Consumer] Created KYC session %s for review", kyc.SessionID)
}

func handleAlertEvent(ctx context.Context, msg kafka.Message) {
	log.Printf("[Kafka Consumer] Ingested alert event: %s", string(msg.Value))
}
