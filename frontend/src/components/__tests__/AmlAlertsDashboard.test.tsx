import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmlAlertsDashboard } from '../AmlAlertsDashboard';
import * as api from '../../api';

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    apiList: vi.fn(),
    apiRequest: vi.fn(),
  };
});

describe('AmlAlertsDashboard Component', () => {
  const mockAlerts = [
    {
      id: 1,
      alertId: 'alert-001',
      triggerTransactionId: 'tx-001',
      primaryAccountNumber: 'ACC-1001',
      alertType: 'RAPID_MOVEMENT',
      status: 'OPEN',
      riskScore: 9.0,
      totalAmount: 1000000000,
      currency: 'VND',
      timeWindowSeconds: 60,
      involvedAccounts: [{ accountNumber: 'ACC-1001', role: 'SOURCE', totalInflow: 0, totalOutflow: 1000000000 }],
      transactionChain: [{ txId: 'tx-001', from: 'ACC-1001', to: 'ACC-2002', amount: 500000000, timestamp: '2026-07-31T12:00:00Z', channel: 'bank_transfer' }],
      graphData: { nodes: [], edges: [] },
      createdAt: '2026-07-31T12:00:00Z',
      accountStatus: 'FROZEN',
    },
    {
      id: 2,
      alertId: 'alert-002',
      triggerTransactionId: 'tx-002',
      primaryAccountNumber: 'ACC-1002',
      alertType: 'STRUCTURING',
      status: 'ESCALATED',
      riskScore: 7.5,
      totalAmount: 380000000,
      currency: 'VND',
      timeWindowSeconds: 60,
      involvedAccounts: [{ accountNumber: 'ACC-1002', role: 'SOURCE', totalInflow: 0, totalOutflow: 380000000 }],
      transactionChain: [],
      graphData: { nodes: [], edges: [] },
      createdAt: '2026-07-31T12:05:00Z',
      accountStatus: 'ACTIVE',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiList).mockResolvedValue(mockAlerts);
    vi.mocked(api.apiRequest).mockResolvedValue({ message: 'Success' });
  });

  it('renders alerts and title correctly', async () => {
    render(<AmlAlertsDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /AML Alerts/i })).toBeInTheDocument();
      expect(screen.getByText('alert-001')).toBeInTheDocument();
      expect(screen.getByText('alert-002')).toBeInTheDocument();
    });
  });

  it('renders Freeze/Unfreeze button in expanded alert card according to accountStatus', async () => {
    render(<AmlAlertsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('alert-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alert-001'));
    await waitFor(() => {
      expect(screen.getByText('Unfreeze Account')).toBeInTheDocument();
    });
  });

  it('calls POST /aml/unfreeze/ACC-1001 when Unfreeze Account is clicked', async () => {
    render(<AmlAlertsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('alert-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alert-001'));
    await waitFor(() => {
      expect(screen.getByText('Unfreeze Account')).toBeInTheDocument();
    });

    const unfreezeBtn = screen.getByText('Unfreeze Account');
    fireEvent.click(unfreezeBtn);

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/aml/unfreeze/ACC-1001', { method: 'POST' });
    });
  });

  it('calls POST /aml/freeze/ACC-1002 when Freeze Account is clicked', async () => {
    render(<AmlAlertsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('alert-002')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alert-002'));
    await waitFor(() => {
      expect(screen.getByText('Freeze Account')).toBeInTheDocument();
    });

    const freezeBtn = screen.getByText('Freeze Account');
    fireEvent.click(freezeBtn);

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/aml/freeze/ACC-1002', { method: 'POST' });
    });
  });

  it('filters alerts when search input is typed', async () => {
    render(<AmlAlertsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('alert-001')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Search AML alerts/i);
    fireEvent.change(searchInput, { target: { value: 'alert-002' } });

    await waitFor(() => {
      expect(screen.queryByText('alert-001')).not.toBeInTheDocument();
      expect(screen.getByText('alert-002')).toBeInTheDocument();
    });
  });
});
