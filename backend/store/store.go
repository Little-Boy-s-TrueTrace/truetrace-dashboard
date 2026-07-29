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
}

func InitStore() {
	InitDB()
	CreateTables()
	LoadAllFromDB()

	DB.Mu.Lock()
	defer DB.Mu.Unlock()

	// Seed Agents
	agents := []models.AgentStatus{
		{AgentID: "agent-1", AgentName: "deepfake-inspector", Status: "active", LastActivity: time.Now(), ProcessedCount: 47, ErrorCount: 2, QueueDepth: 5},
		{AgentID: "agent-2", AgentName: "money-trail-explorer", Status: "active", LastActivity: time.Now(), ProcessedCount: 12, ErrorCount: 1, QueueDepth: 12},
		{AgentID: "agent-3", AgentName: "aml-reporter", Status: "active", LastActivity: time.Now(), ProcessedCount: 8, ErrorCount: 0, QueueDepth: 0},
	}
	for i := range agents {
		DB.AgentStatuses[agents[i].AgentID] = &agents[i]
	}

	if len(DB.KycSessions) == 0 && len(DB.AmlAlerts) == 0 {
		// Seed KycSessions
		DB.KycSessions = append(DB.KycSessions, &models.KycSession{
			ID:                     1,
			SessionID:              "kyc-001",
			CustomerID:             "cust-123",
			CustomerName:           "Nguyen Van A",
			Status:                 "APPROVED",
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
		DB.KycSessions = append(DB.KycSessions, &models.KycSession{
			ID:                     2,
			SessionID:              "kyc-002",
			CustomerID:             "cust-124",
			CustomerName:           "Tran Van B",
			Status:                 "MANUAL_REVIEW",
			DeepfakeScore:          0.85,
			FaceMatchScore:         0.45,
			DocumentIntegrityScore: 0.92,
			LivenessScore:          0.40,
			CCCDNumber:             "987654321098",
			CCCDValid:              true,
			RiskLevel:              "high",
			RecommendedAction:      "manual_review",
			CreatedAt:              time.Now().Add(-1 * time.Hour),
		})

		// Seed AmlAlerts
		DB.AmlAlerts = append(DB.AmlAlerts, &models.AmlAlert{
			ID:                   1,
			AlertID:              "aml-001",
			TriggerTransactionID: "tx-999",
			PrimaryAccountNumber: "acc-456",
			AlertType:            "STRUCTURING",
			Status:               "OPEN",
			RiskScore:            0.85,
			TotalAmount:          23500000.0,
			Currency:             "VND",
			TimeWindowSeconds:    3600,
			CreatedAt:            time.Now().Add(-1 * time.Hour),
		})
		DB.AmlAlerts = append(DB.AmlAlerts, &models.AmlAlert{
			ID:                   2,
			AlertID:              "aml-002",
			TriggerTransactionID: "tx-1002",
			PrimaryAccountNumber: "acc-789",
			AlertType:            "RAPID_MOVEMENT",
			Status:               "INVESTIGATING",
			RiskScore:            0.92,
			TotalAmount:          1500000000.0,
			Currency:             "VND",
			TimeWindowSeconds:    0,
			CreatedAt:            time.Now().Add(-30 * time.Minute),
		})

		// Seed StrReports
		DB.StrReports = append(DB.StrReports, &models.StrReport{
			ID:                1,
			ReportID:          "str-001",
			ReportType:        "STR",
			Status:            "DRAFT",
			SubjectFullName:   "Tran Van B",
			SubjectCCCDNumber: "987654321098",
			TotalAmount:       1500000000.0,
			Currency:          "VND",
			RiskLevel:         "high",
			RiskScore:         0.92,
			NarrativeTextVi:   "Suspicious activity related to money laundering.",
			NarrativeTextEn:   "Suspicious activity related to money laundering.",
			GeneratedAt:       time.Now().Add(-30 * time.Minute),
		})
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

	kycCount := len(db.KycSessions)
	amlCount := len(db.AmlAlerts)
	strCount := len(db.StrReports)

	deepfakes := 0
	approved := 0
	var totalProcessingTime float64
	for _, s := range db.KycSessions {
		if s.DeepfakeScore > 0.7 {
			deepfakes++
		}
		if s.Status == "APPROVED" {
			approved++
		}
	}

	approvalRate := 0.0
	if kycCount > 0 {
		approvalRate = float64(approved) / float64(kycCount)
	}

	freezes := 0
	for _, a := range db.AmlAlerts {
		if a.Status == "OPEN" || a.Status == "INVESTIGATING" {
			freezes++
		}
	}

	return models.ComplianceStats{
		TotalKycProcessed:   kycCount,
		DeepfakesDetected:   deepfakes,
		AmlAlertsRaised:     amlCount,
		StrReportsGenerated: strCount,
		ActiveFreezes:       freezes,
		KycApprovalRate:     approvalRate,
		AvgProcessingTimeMs: totalProcessingTime,
	}
}

func (db *Database) persistSeed() {
	// Dummy persist method
}
