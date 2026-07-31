import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplianceOverview } from '../ComplianceOverview';
import * as api from '../../api';

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    apiList: vi.fn(),
    apiRequest: vi.fn(),
  };
});

describe('ComplianceOverview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiRequest).mockImplementation((endpoint: string) => {
      if (endpoint === '/compliance/stats') {
        return Promise.resolve({
          totalKycProcessed: 120,
          kycApprovalRate: 95.0,
          deepfakesDetected: 3,
          amlAlertsRaised: 15,
          strReportsGenerated: 5,
          activeFreezes: 2,
        });
      }
      return Promise.resolve({});
    });
    vi.mocked(api.apiList).mockImplementation((endpoint: string) => {
      if (endpoint === '/agents/status') {
        return Promise.resolve([
          { agentId: 'deepfake-inspector', name: 'Agent 1: Deepfake Inspector', status: 'RUNNING' },
          { agentId: 'money-trail', name: 'Agent 2: Money-Trail Explorer', status: 'RUNNING' },
          { agentId: 'aml-reporter', name: 'Agent 3: AML STR Reporter', status: 'RUNNING' },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('renders summary cards and title', async () => {
    render(<ComplianceOverview onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Compliance Command Center/i)).toBeInTheDocument();
      expect(screen.getByText('KYC Processed')).toBeInTheDocument();
      expect(screen.getByText('Deepfakes Caught')).toBeInTheDocument();
      expect(screen.getByText('AML Alerts')).toBeInTheDocument();
      expect(screen.getByText('STR Reports')).toBeInTheDocument();
    });
  });
});
