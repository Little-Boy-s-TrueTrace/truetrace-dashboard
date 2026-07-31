import type {
  AgentStatus,
  AmlAlert,
  GraphData,
  InvolvedAccount,
  StrReport,
  TransactionChainItem,
} from './types';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : typeof payload === 'string' && payload
        ? payload
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function apiList<T>(path: string): Promise<T[]> {
  const payload = await apiRequest<unknown>(path);
  if (!Array.isArray(payload)) {
    throw new ApiError('The server returned an invalid list response.', 502);
  }
  return payload as T[];
}

export const newestFirst = <T extends {
  id?: string | number;
  createdAt?: string;
  generatedAt?: string;
  updatedAt?: string;
}>(
  values: T[],
) => [...values].sort((a, b) => {
  const aId = Number(a.id);
  const bId = Number(b.id);
  if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) {
    return bId - aId;
  }
  const aTime = apiDate(a.updatedAt || a.generatedAt || a.createdAt || 0).getTime() || 0;
  const bTime = apiDate(b.updatedAt || b.generatedAt || b.createdAt || 0).getTime() || 0;
  return bTime - aTime;
});

export const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const apiDate = (value: unknown) => {
  if (typeof value === 'number') {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  const raw = String(value || '');
  const normalized = /^\d{4}-\d{2}-\d{2}T/.test(raw)
    && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
    ? `${raw}Z`
    : raw;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
};

export const formatApiTimestamp = (value: unknown) => {
  if (!value || value === 'never') return 'No activity recorded';
  const parsed = apiDate(value);
  return parsed.getTime() === 0 ? String(value) : parsed.toLocaleString();
};

const isoTimestamp = (value: unknown) => apiDate(value).toISOString();

export const normalizeRiskScore = (value: unknown) => {
  const score = Number(value) || 0;
  if (score > 10 && score <= 100) return score / 10;
  return score > 0 && score <= 1 ? score * 10 : score;
};

export const normalizeAgentStatus = (status: string): AgentStatus['status'] => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'RESTARTING') return 'RUNNING';
  if (normalized === 'ERROR' || normalized === 'FAILED') return 'ERROR';
  return normalized === 'RUNNING' ? 'RUNNING' : 'IDLE';
};

export function normalizeAmlAlert(raw: Record<string, any>): AmlAlert {
  const primary = String(raw.primaryAccountNumber || raw.account || '');
  const rawChain = Array.isArray(raw.transactionChain)
    ? raw.transactionChain
    : parseJson<any[]>(raw.transactionChainJson, []);
  const transactionChain: TransactionChainItem[] = rawChain.map((tx, index) => ({
    txId: String(tx.txId || tx.tx_id || raw.triggerTransactionId || `tx-${index + 1}`),
    from: String(tx.from || tx.from_account || primary),
    to: String(tx.to || tx.to_account || ''),
    amount: Number(tx.amount) || 0,
    timestamp: isoTimestamp(tx.timestamp),
    channel: String(tx.channel || 'bank_transfer'),
  }));

  const rawAccounts = Array.isArray(raw.involvedAccounts)
    ? raw.involvedAccounts
    : parseJson<any[]>(raw.involvedAccountsJson, []);
  const involvedAccounts: InvolvedAccount[] = rawAccounts.map((account) => {
    if (typeof account === 'string') {
      return {
        accountNumber: account,
        role: account === primary ? 'SOURCE' : 'DESTINATION',
        totalInflow: 0,
        totalOutflow: 0,
      };
    }
    const accountNumber = String(account.accountNumber || account.account || '');
    const rawRole = String(account.role || '').toUpperCase();
    return {
      accountNumber,
      role: rawRole === 'SOURCE' || rawRole === 'INTERMEDIARY' ? rawRole : 'DESTINATION',
      totalInflow: Number(account.totalInflow ?? account.total_in) || 0,
      totalOutflow: Number(account.totalOutflow ?? account.total_out) || 0,
    };
  });

  if (primary && !involvedAccounts.some((account) => account.accountNumber === primary)) {
    involvedAccounts.unshift({
      accountNumber: primary,
      role: 'SOURCE',
      totalInflow: 0,
      totalOutflow: Number(raw.totalAmount) || 0,
    });
  }

  const parsedGraph = raw.graphData?.nodes
    ? raw.graphData
    : parseJson<Record<string, any>>(raw.graphDataJson, {});
  let graphData: GraphData;
  if (Array.isArray(parsedGraph.nodes) && Array.isArray(parsedGraph.edges)) {
    graphData = parsedGraph as GraphData;
  } else {
    const accountIds = new Set<string>();
    if (primary) accountIds.add(primary);
    transactionChain.forEach((tx) => {
      if (tx.from) accountIds.add(tx.from);
      if (tx.to) accountIds.add(tx.to);
    });
    graphData = {
      nodes: [...accountIds].map((id) => ({
        id,
        label: id,
        type: id === primary ? 'source' : 'destination',
        riskLevel: id === primary ? 'HIGH' : 'UNKNOWN',
      })),
      edges: transactionChain.map((tx) => ({
        source: tx.from,
        target: tx.to,
        amount: tx.amount,
        timestamp: tx.timestamp,
      })),
    };
  }

  return {
    id: Number(raw.id) || 0,
    alertId: String(raw.alertId || raw.alert_id || ''),
    triggerTransactionId: String(raw.triggerTransactionId || raw.tx_id || ''),
    primaryAccountNumber: primary,
    alertType: String(raw.alertType || 'MULE_SPLIT').toUpperCase() as AmlAlert['alertType'],
    status: String(raw.status || 'OPEN').toUpperCase() as AmlAlert['status'],
    riskScore: normalizeRiskScore(raw.riskScore ?? raw.risk_score),
    totalAmount: Number(raw.totalAmount ?? raw.total_amount) || 0,
    currency: String(raw.currency || 'VND'),
    timeWindowSeconds: Number(raw.timeWindowSeconds ?? raw.time_window_seconds) || 0,
    involvedAccounts,
    transactionChain,
    graphData,
    createdAt: isoTimestamp(raw.createdAt || raw.timestamp),
    accountStatus: raw.accountStatus ? String(raw.accountStatus) : undefined,
    resolvedAt: raw.resolvedAt ? isoTimestamp(raw.resolvedAt) : undefined,
    resolvedBy: raw.resolvedBy,
    agentFinding: parseJson<Record<string, unknown>>(raw.agentFindingJson || raw.agentFinding, {}),
  };
}

export function normalizeStrReport(raw: Record<string, any>): StrReport {
  return {
    id: Number(raw.id) || 0,
    reportId: String(raw.reportId || raw.report_id || ''),
    reportType: String(raw.reportType || 'STR') as StrReport['reportType'],
    status: String(raw.status || 'DRAFT').toUpperCase() as StrReport['status'],
    subjectFullName: String(raw.subjectFullName || ''),
    subjectCccdNumber: String(raw.subjectCccdNumber || ''),
    totalAmount: Number(raw.totalAmount) || 0,
    currency: String(raw.currency || 'VND'),
    riskLevel: String(raw.riskLevel || 'UNKNOWN').toUpperCase(),
    riskScore: normalizeRiskScore(raw.riskScore),
    narrativeTextVi: String(raw.narrativeTextVi || ''),
    narrativeTextEn: String(raw.narrativeTextEn || ''),
    generatedAt: isoTimestamp(raw.generatedAt),
    submittedAt: raw.submittedAt ? isoTimestamp(raw.submittedAt) : undefined,
    reviewedBy: raw.reviewedBy,
    submittedBy: raw.submittedBy,
    evidenceSummary: parseJson<Record<string, unknown>>(raw.evidenceSummaryJson, {}),
    transactionDetails: parseJson<unknown>(raw.transactionDetailsJson, null),
    recommendedActions: parseJson<string[]>(raw.recommendedActionsJson, []),
    regulatoryReferences: parseJson<string[]>(raw.regulatoryReferencesJson, []),
  };
}
