export interface KycSession {
  id: number;
  sessionId: string;
  customerId: string;
  customerName: string;
  status: 'PENDING' | 'ANALYZING' | 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  deepfakeScore: number;
  faceMatchScore: number;
  documentIntegrityScore: number;
  livenessScore: number;
  cccdNumber: string;
  cccdValid: boolean;
  riskLevel: string;
  recommendedAction: string;
  createdAt: string;
  updatedAt?: string;
  reviewedBy?: string;
  selfieImagePath?: string;
  idFrontImagePath?: string;
  idBackImagePath?: string;
}

export interface AmlAlert {
  id: number;
  alertId: string;
  triggerTransactionId: string;
  primaryAccountNumber: string;
  alertType: 'MULE_SPLIT' | 'STRUCTURING' | 'CIRCULAR_FLOW' | 'VELOCITY_ANOMALY' | 'RAPID_MOVEMENT' | 'RAPID_MULE_DISPERSION' | 'FAN_IN' | 'FAN_OUT' | 'NEW_ACCOUNT_ABUSE';
  status: 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'CLOSED' | 'FALSE_POSITIVE';
  riskScore: number;
  totalAmount: number;
  currency: string;
  timeWindowSeconds: number;
  involvedAccounts: InvolvedAccount[];
  transactionChain: TransactionChainItem[];
  graphData: GraphData;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  agentFinding?: Record<string, unknown>;
}

export interface InvolvedAccount {
  accountNumber: string;
  role: 'SOURCE' | 'INTERMEDIARY' | 'DESTINATION';
  totalInflow: number;
  totalOutflow: number;
}

export interface TransactionChainItem {
  txId: string;
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  channel: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'source' | 'intermediary' | 'destination';
  riskLevel: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  timestamp: string;
}

export interface StrReport {
  id: number;
  reportId: string;
  reportType: 'STR' | 'CTR' | 'SAR';
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'SUBMITTED' | 'ARCHIVED';
  subjectFullName: string;
  subjectCccdNumber: string;
  totalAmount: number;
  currency: string;
  riskLevel: string;
  riskScore: number;
  narrativeTextVi: string;
  narrativeTextEn: string;
  generatedAt: string;
  submittedAt?: string;
  reviewedBy?: string;
  submittedBy?: string;
  evidenceSummary?: Record<string, unknown>;
  transactionDetails?: unknown;
  recommendedActions?: string[];
  regulatoryReferences?: string[];
}

export interface ComplianceStats {
  totalKycProcessed: number;
  deepfakesDetected: number;
  amlAlertsRaised: number;
  strReportsGenerated: number;
  activeFreezes: number;
  kycApprovalRate: number;
  avgProcessingTimeMs: number;
}

export interface AgentStatus {
  agentId: string;
  agentName: string;
  status: 'RUNNING' | 'IDLE' | 'ERROR';
  lastActivity: string;
  processedCount: number;
  errorCount: number;
  queueDepth: number;
}
