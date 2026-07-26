package store

import (
	"dashboard/backend/models"
	"sync"
	"time"
)

type Database struct {
	Mu              sync.RWMutex
	KycSessions     []*models.KycSession
	AmlAlerts       []*models.AmlAlert
	StrReports      []*models.StrReport
	ComplianceStats models.ComplianceStats
	AgentStatuses   map[string]*models.AgentStatus
}

var DB *Database

func init() {
	DB = &Database{
		KycSessions:   make([]*models.KycSession, 0),
		AmlAlerts:     make([]*models.AmlAlert, 0),
		StrReports:    make([]*models.StrReport, 0),
		AgentStatuses: make(map[string]*models.AgentStatus),
	}

	DB.seedDemoData()
}

func (db *Database) seedDemoData() {
	db.Mu.Lock()
	defer db.Mu.Unlock()

	// Seed Agents
	agents := []models.AgentStatus{
		{AgentID: "agent-1", AgentName: "deepfake-inspector", Status: "active", LastActivity: time.Now(), ProcessedCount: 1500, ErrorCount: 2, QueueDepth: 5},
		{AgentID: "agent-2", AgentName: "money-trail-explorer", Status: "active", LastActivity: time.Now(), ProcessedCount: 800, ErrorCount: 1, QueueDepth: 12},
		{AgentID: "agent-3", AgentName: "aml-reporter", Status: "active", LastActivity: time.Now(), ProcessedCount: 300, ErrorCount: 0, QueueDepth: 0},
	}
	for i := range agents {
		db.AgentStatuses[agents[i].AgentID] = &agents[i]
	}

	// Seed KycSessions
	db.KycSessions = append(db.KycSessions, &models.KycSession{
		ID:                     1,
		SessionID:              "kyc-001",
		CustomerID:             "cust-123",
		CustomerName:           "Nguyen Van A",
		Status:                 "approved",
		DeepfakeScore:          0.05,
		FaceMatchScore:         0.98,
		DocumentIntegrityScore: 0.99,
		LivenessScore:          0.97,
		CCCDNumber:             "012345678912",
		CCCDValid:              true,
		RiskLevel:              "low",
		RecommendedAction:      "approve",
		CreatedAt:              time.Now().Add(-2 * time.Hour),
	})

	// Seed AmlAlerts
	db.AmlAlerts = append(db.AmlAlerts, &models.AmlAlert{
		ID:                   1,
		AlertID:              "aml-001",
		TriggerTransactionID: "tx-999",
		PrimaryAccountNumber: "acc-456",
		AlertType:            "structuring",
		Status:               "open",
		RiskScore:            0.85,
		TotalAmount:          50000.0,
		Currency:             "USD",
		TimeWindowSeconds:    3600,
		CreatedAt:            time.Now().Add(-1 * time.Hour),
	})

	// Seed StrReports
	db.StrReports = append(db.StrReports, &models.StrReport{
		ID:                1,
		ReportID:          "str-001",
		ReportType:        "suspicious_activity",
		Status:            "draft",
		SubjectFullName:   "Tran Van B",
		SubjectCCCDNumber: "987654321098",
		TotalAmount:       150000.0,
		Currency:          "USD",
		RiskLevel:         "high",
		RiskScore:         0.92,
		NarrativeTextVi:   "Hoạt động đáng ngờ liên quan đến rửa tiền.",
		NarrativeTextEn:   "Suspicious activity related to money laundering.",
		GeneratedAt:       time.Now().Add(-30 * time.Minute),
	})

	// Seed ComplianceStats
	db.ComplianceStats = models.ComplianceStats{
		TotalKycProcessed:   1500,
		DeepfakesDetected:   25,
		AmlAlertsRaised:     800,
		StrReportsGenerated: 300,
		ActiveFreezes:       10,
		KycApprovalRate:     0.95,
		AvgProcessingTimeMs: 1200.5,
	}
}

func (db *Database) GetKycSessions() []*models.KycSession {
	db.Mu.RLock()
	defer db.Mu.RUnlock()
	return db.KycSessions
}

func (db *Database) GetAmlAlerts() []*models.AmlAlert {
	db.Mu.RLock()
	defer db.Mu.RUnlock()
	return db.AmlAlerts
}

func (db *Database) GetStrReports() []*models.StrReport {
	db.Mu.RLock()
	defer db.Mu.RUnlock()
	return db.StrReports
}

func (db *Database) GetAgentStatuses() []*models.AgentStatus {
	db.Mu.RLock()
	defer db.Mu.RUnlock()
	var statuses []*models.AgentStatus
	for _, status := range db.AgentStatuses {
		statuses = append(statuses, status)
	}
	return statuses
}

func (db *Database) GetComplianceStats() models.ComplianceStats {
	db.Mu.RLock()
	defer db.Mu.RUnlock()
	return db.ComplianceStats
}

func (db *Database) persistSeed() {
	// Dummy persist method
}
