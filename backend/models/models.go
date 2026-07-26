package models

import "time"

type AuthRequest struct {
	UID string `json:"uid"`
}

type AuthResponse struct {
	UID      string    `json:"uid"`
	Username string    `json:"username"`
	Token    string    `json:"token"`
	Expiry   time.Time `json:"expiry"`
}

type LoginRequest struct {
	UID   string `json:"uid"`
	Token string `json:"token"`
}

type LoginResponse struct {
	UID          string    `json:"uid"`
	Username     string    `json:"username"`
	SessionToken string    `json:"sessionToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

type AuthStatus struct {
	IsAuthenticated bool      `json:"isAuthenticated"`
	Username        string    `json:"username"`
	UID             string    `json:"uid,omitempty"`
	ExpiresAt       time.Time `json:"expiresAt,omitempty"`
}

type KycSession struct {
	ID                     int       `json:"id"`
	SessionID              string    `json:"sessionId"`
	CustomerID             string    `json:"customerId"`
	CustomerName           string    `json:"customerName"`
	Status                 string    `json:"status"`
	DeepfakeScore          float64   `json:"deepfakeScore"`
	FaceMatchScore         float64   `json:"faceMatchScore"`
	DocumentIntegrityScore float64   `json:"documentIntegrityScore"`
	LivenessScore          float64   `json:"livenessScore"`
	CCCDNumber             string    `json:"cccdNumber"`
	CCCDValid              bool      `json:"cccdValid"`
	RiskLevel              string    `json:"riskLevel"`
	RecommendedAction      string    `json:"recommendedAction"`
	CreatedAt              time.Time `json:"createdAt"`
	ReviewedBy             string    `json:"reviewedBy,omitempty"`
}

type InvolvedAccount struct {
	AccountNumber string  `json:"accountNumber"`
	Role          string  `json:"role"`
	TotalInflow   float64 `json:"totalInflow"`
	TotalOutflow  float64 `json:"totalOutflow"`
}

type TransactionChainItem struct {
	TxID      string    `json:"txId"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Amount    float64   `json:"amount"`
	Timestamp time.Time `json:"timestamp"`
	Channel   string    `json:"channel"`
}

type GraphNode struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Type      string `json:"type"`
	RiskLevel string `json:"riskLevel"`
}

type GraphEdge struct {
	Source    string    `json:"source"`
	Target    string    `json:"target"`
	Amount    float64   `json:"amount"`
	Timestamp time.Time `json:"timestamp"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

type AmlAlert struct {
	ID                   int                    `json:"id"`
	AlertID              string                 `json:"alertId"`
	TriggerTransactionID string                 `json:"triggerTransactionId"`
	PrimaryAccountNumber string                 `json:"primaryAccountNumber"`
	AlertType            string                 `json:"alertType"`
	Status               string                 `json:"status"`
	RiskScore            float64                `json:"riskScore"`
	TotalAmount          float64                `json:"totalAmount"`
	Currency             string                 `json:"currency"`
	TimeWindowSeconds    int                    `json:"timeWindowSeconds"`
	InvolvedAccounts     []InvolvedAccount      `json:"involvedAccounts"`
	TransactionChain     []TransactionChainItem `json:"transactionChain"`
	GraphData            GraphData              `json:"graphData"`
	CreatedAt            time.Time              `json:"createdAt"`
	ResolvedAt           *time.Time             `json:"resolvedAt,omitempty"`
	ResolvedBy           string                 `json:"resolvedBy,omitempty"`
}

type StrReport struct {
	ID                int        `json:"id"`
	ReportID          string     `json:"reportId"`
	ReportType        string     `json:"reportType"`
	Status            string     `json:"status"`
	SubjectFullName   string     `json:"subjectFullName"`
	SubjectCCCDNumber string     `json:"subjectCccdNumber"`
	TotalAmount       float64    `json:"totalAmount"`
	Currency          string     `json:"currency"`
	RiskLevel         string     `json:"riskLevel"`
	RiskScore         float64    `json:"riskScore"`
	NarrativeTextVi   string     `json:"narrativeTextVi"`
	NarrativeTextEn   string     `json:"narrativeTextEn"`
	GeneratedAt       time.Time  `json:"generatedAt"`
	SubmittedAt       *time.Time `json:"submittedAt,omitempty"`
}

type ComplianceStats struct {
	TotalKycProcessed   int     `json:"totalKycProcessed"`
	DeepfakesDetected   int     `json:"deepfakesDetected"`
	AmlAlertsRaised     int     `json:"amlAlertsRaised"`
	StrReportsGenerated int     `json:"strReportsGenerated"`
	ActiveFreezes       int     `json:"activeFreezes"`
	KycApprovalRate     float64 `json:"kycApprovalRate"`
	AvgProcessingTimeMs float64 `json:"avgProcessingTimeMs"`
}

type AgentStatus struct {
	AgentID        string    `json:"agentId"`
	AgentName      string    `json:"agentName"`
	Status         string    `json:"status"`
	LastActivity   time.Time `json:"lastActivity"`
	ProcessedCount int       `json:"processedCount"`
	ErrorCount     int       `json:"errorCount"`
	QueueDepth     int       `json:"queueDepth,omitempty"`
}

