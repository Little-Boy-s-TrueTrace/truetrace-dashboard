import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KycVerificationCenter } from './KycVerificationCenter';
import { AmlAlertsDashboard } from './AmlAlertsDashboard';
import { StrReportManager } from './StrReportManager';
import { ComplianceOverview } from './ComplianceOverview';
import { AgentMonitor } from './AgentMonitor';
import { apiDate, newestFirst } from '../api';

const jsonResponse = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
}) as Response;

const kycSession = {
  id: 1,
  sessionId: 'kyc-demo-001',
  customerId: '42',
  customerName: 'Nguyen Demo',
  status: 'MANUAL_REVIEW',
  deepfakeScore: 12,
  faceMatchScore: 94,
  documentIntegrityScore: 98,
  livenessScore: 91,
  cccdNumber: '001234567890',
  cccdValid: true,
  riskLevel: 'MEDIUM',
  recommendedAction: 'REVIEW_EVIDENCE',
  createdAt: '2026-07-30T00:00:00Z',
};

const amlAlert = {
  id: 2,
  alertId: 'aml-demo-001',
  triggerTransactionId: 'tx-demo-001',
  primaryAccountNumber: 'ACC-111111',
  alertType: 'STRUCTURING',
  status: 'OPEN',
  riskScore: 0.85,
  totalAmount: 390_000_000,
  currency: 'VND',
  timeWindowSeconds: 60,
  involvedAccountsJson: JSON.stringify(['ACC-111111', 'ACC-222222']),
  transactionChainJson: JSON.stringify([
    {
      tx_id: 'tx-demo-001',
      from_account: 'ACC-111111',
      to_account: 'ACC-222222',
      amount: 195_000_000,
      timestamp: 1785369600,
    },
  ]),
  agentFindingJson: JSON.stringify({
    findings: [{ pattern: 'structuring', details: 'Two transfers were observed near the configured threshold.' }],
  }),
  createdAt: '2026-07-30T00:02:00Z',
};

const draftReport = {
  id: 3,
  reportId: 'str-demo-001',
  reportType: 'STR',
  status: 'DRAFT',
  subjectFullName: 'Nguyen Demo',
  subjectCccdNumber: '001234567890',
  totalAmount: 390_000_000,
  currency: 'VND',
  riskLevel: 'HIGH',
  riskScore: 8.5,
  narrativeTextVi: 'Phân tích dựa trên gói bằng chứng.',
  narrativeTextEn: 'Analysis based on the evidence package.',
  evidenceSummaryJson: JSON.stringify({
    alert: { alert_id: 'aml-demo-001', account: 'ACC-111111' },
  }),
  recommendedActionsJson: JSON.stringify(['HUMAN_REVIEW']),
  regulatoryReferencesJson: JSON.stringify(['Circular 09/2023/TT-NHNN']),
  generatedAt: '2026-07-30T00:03:00Z',
};

describe('five-minute demo UI flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('normalizes unzoned Spring timestamps as UTC', () => {
    expect(apiDate('2026-07-29T17:29:30').toISOString())
      .toBe('2026-07-29T17:29:30.000Z');
  });

  test('keeps newly inserted records above legacy rows with inconsistent timestamps', () => {
    const sorted = newestFirst([
      { id: 41, createdAt: '2026-07-30T07:07:28Z' },
      { id: 42, createdAt: '2026-07-30T00:29:30Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([42, 41]);
  });

  test('KYC search is real and approve persists through the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/kyc/kyc-demo-001/approve') && init?.method === 'POST') {
        return jsonResponse({ ...kycSession, status: 'APPROVED' });
      }
      return jsonResponse([kycSession]);
    });

    render(<KycVerificationCenter />);
    expect(await screen.findByText('Nguyen Demo')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search KYC sessions'), { target: { value: 'missing' } });
    expect(screen.getByText(/No KYC sessions match/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search KYC sessions'), { target: { value: 'Nguyen' } });

    fireEvent.click(screen.getByText('Nguyen Demo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/kyc/kyc-demo-001/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  test('AML evidence JSON is parsed, legacy 0..1 risk is normalized, and escalation is real', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/aml/aml-demo-001/escalate') && init?.method === 'POST') {
        return jsonResponse({ ...amlAlert, status: 'ESCALATED' });
      }
      return jsonResponse([amlAlert]);
    });

    render(<AmlAlertsDashboard />);
    expect(await screen.findByText('8.5')).toBeInTheDocument();
    fireEvent.click(screen.getByText('STRUCTURING'));
    expect(await screen.findByText(/Two transfers were observed near/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Escalate to STR' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/aml/aml-demo-001/escalate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  test('a DRAFT STR is marked ready with complete narratives and evidence', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/str/str-demo-001/status') && init?.method === 'PUT') {
        return jsonResponse({ ...draftReport, status: 'READY_FOR_REVIEW' });
      }
      return jsonResponse([draftReport]);
    });

    render(<StrReportManager />);
    fireEvent.click(await screen.findByText('str-demo-001'));
    expect(screen.getByText('Phân tích dựa trên gói bằng chứng.')).toBeInTheDocument();
    expect(screen.getByText('Analysis based on the evidence package.')).toBeInTheDocument();
    expect(screen.getByText('Circular 09/2023/TT-NHNN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Ready for Review' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/str/str-demo-001/status',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"status":"READY_FOR_REVIEW"'),
        }),
      );
    });
  });

  test('a reviewed STR uses the submit endpoint instead of a fake alert', async () => {
    const readyReport = { ...draftReport, status: 'READY_FOR_REVIEW' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/str/str-demo-001/submit') && init?.method === 'POST') {
        return jsonResponse({ ...readyReport, status: 'SUBMITTED' });
      }
      return jsonResponse([readyReport]);
    });

    render(<StrReportManager />);
    fireEvent.click(await screen.findByText('str-demo-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/str/str-demo-001/submit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  test('overview converts legacy ratio approval rate and live agent status correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/compliance/stats')) {
        return jsonResponse({
          totalKycProcessed: 2,
          deepfakesDetected: 1,
          amlAlertsRaised: 1,
          strReportsGenerated: 1,
          activeFreezes: 1,
          kycApprovalRate: 0.5,
          avgProcessingTimeMs: 0,
        });
      }
      if (url.endsWith('/agents/status')) {
        return jsonResponse([{
          agentId: 'agent-1',
          agentName: 'deepfake-inspector',
          status: 'active',
          lastActivity: '2026-07-30T00:00:00Z',
          processedCount: 2,
          errorCount: 0,
          queueDepth: 0,
        }]);
      }
      if (url.endsWith('/aml')) return jsonResponse([amlAlert]);
      if (url.endsWith('/kyc')) return jsonResponse([kycSession]);
      return jsonResponse({}, 404);
    });

    render(<ComplianceOverview />);
    expect(await screen.findByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  test('agent monitor shows live health without fake restart or log actions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse([{
        agentId: 'money-trail',
        agentName: 'Transactions Graph Explorer',
        status: 'RUNNING',
        lastActivity: '2026-07-30T00:00:00Z',
        processedCount: 9,
        healthSource: 'agent-engine /health',
      }]));

    render(<AgentMonitor />);

    expect(await screen.findByText('Persisted Records')).toBeInTheDocument();
    expect(screen.getByText(/Health source: agent-engine \/health/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Logs' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh health' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
