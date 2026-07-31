import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycVerificationCenter } from '../KycVerificationCenter';
import * as api from '../../api';

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    apiList: vi.fn(),
    apiRequest: vi.fn(),
  };
});

describe('KycVerificationCenter Component', () => {
  const mockKycList = [
    {
      id: 10,
      sessionId: 'kyc-session-001',
      accountId: 'ACC-101',
      customerId: 'CUST-101',
      status: 'APPROVED',
      cccdNumber: '001099123456',
      customerName: 'Nguyen Van A',
      riskScore: 2.0,
      riskLevel: 'LOW',
      deepfakeProbability: 0.05,
      createdAt: '2026-07-31T10:00:00Z',
    },
    {
      id: 11,
      sessionId: 'kyc-session-002',
      accountId: 'ACC-102',
      customerId: 'CUST-102',
      status: 'MANUAL_REVIEW',
      cccdNumber: '001099999888',
      customerName: 'Le Van B',
      riskScore: 6.5,
      riskLevel: 'MEDIUM',
      deepfakeProbability: 0.6,
      createdAt: '2026-07-31T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiList).mockResolvedValue(mockKycList);
    vi.mocked(api.apiRequest).mockResolvedValue({ status: 'APPROVED' });
  });

  it('renders KYC Verification Center title and sessions', async () => {
    render(<KycVerificationCenter />);
    await waitFor(() => {
      expect(screen.getByText('KYC Verification Center')).toBeInTheDocument();
      expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
      expect(screen.getByText('Le Van B')).toBeInTheDocument();
    });
  });

  it('filters sessions by search query', async () => {
    render(<KycVerificationCenter />);
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Search KYC sessions/i);
    fireEvent.change(searchInput, { target: { value: 'Le Van B' } });

    await waitFor(() => {
      expect(screen.queryByText('Nguyen Van A')).not.toBeInTheDocument();
      expect(screen.getByText('Le Van B')).toBeInTheDocument();
    });
  });
});
