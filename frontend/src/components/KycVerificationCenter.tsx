import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KycSession } from '../types';
import {
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  CreditCard,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { apiList, apiRequest, newestFirst } from '../api';

const POLL_INTERVAL_MS = 3000;

export const KycVerificationCenter: React.FC = () => {
  const [sessions, setSessions] = useState<KycSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionId, setActionId] = useState('');

  const loadSessions = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiList<KycSession>('/kyc');
      setSessions(newestFirst(data));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load KYC sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(() => void loadSessions(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  const visibleSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesQuery = !normalizedQuery || [
        session.customerName,
        session.cccdNumber,
        session.sessionId,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === 'ALL' || session.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, sessions, statusFilter]);

  const reviewSession = async (session: KycSession, decision: 'approve' | 'reject') => {
    setActionId(session.sessionId);
    setMessage('');
    setError('');
    try {
      await apiRequest<KycSession>(`/kyc/${encodeURIComponent(session.sessionId)}/${decision}`, {
        method: 'POST',
      });
      setMessage(`${session.customerName}'s KYC session was ${decision === 'approve' ? 'approved' : 'rejected'} and saved.`);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${decision} this KYC session.`);
    } finally {
      setActionId('');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-500/20 text-yellow-400',
      ANALYZING: 'bg-blue-500/20 text-blue-400',
      APPROVED: 'bg-emerald-500/20 text-emerald-400',
      REJECTED: 'bg-red-500/20 text-red-400',
      MANUAL_REVIEW: 'bg-orange-500/20 text-orange-400',
    };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status] || 'bg-slate-500/20 text-slate-400'}`}>{status}</span>;
  };

  const getScoreColor = (score: number, inverse = false) => {
    if (inverse) {
      if (score > 80) return 'text-red-400';
      if (score > 40) return 'text-yellow-400';
      return 'text-emerald-400';
    }
    if (score > 80) return 'text-emerald-400';
    if (score > 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">KYC Verification Center</h1>
          <p className="text-xs text-slate-500 mt-1">Live sessions · newest first · refreshes every 3 seconds</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              aria-label="Search KYC sessions"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, CCCD, session…"
              className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            aria-label="Filter KYC status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-300"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ANALYZING">Analyzing</option>
            <option value="MANUAL_REVIEW">Manual review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            onClick={() => void loadSessions(true)}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800/80 sticky top-0 z-10 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-4 font-medium">Customer Name</th>
                <th className="p-4 font-medium">CCCD</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Deepfake Score</th>
                <th className="p-4 font-medium">Face Match</th>
                <th className="p-4 font-medium">Risk Level</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {loading && sessions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading KYC sessions…</td></tr>
              ) : visibleSessions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">No KYC sessions match the current search and filter.</td></tr>
              ) : visibleSessions.map((session) => (
                <React.Fragment key={session.sessionId || session.id}>
                  <tr
                    className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === session.sessionId ? null : session.sessionId)}
                  >
                    <td className="p-4 font-medium text-slate-200">{session.customerName || 'Unlinked customer'}</td>
                    <td className="p-4 text-slate-400 font-mono">{session.cccdNumber || 'Not provided'}</td>
                    <td className="p-4">{getStatusBadge(session.status)}</td>
                    <td className={`p-4 font-medium ${getScoreColor(session.deepfakeScore ?? 0, true)}`}>{(session.deepfakeScore ?? 0).toFixed(1)}%</td>
                    <td className={`p-4 font-medium ${getScoreColor(session.faceMatchScore ?? 0)}`}>{(session.faceMatchScore ?? 0).toFixed(1)}%</td>
                    <td className="p-4 text-slate-300">{session.riskLevel || 'PENDING'}</td>
                    <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(session.updatedAt || session.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      {expandedId === session.sessionId ? <ChevronUp className="w-5 h-5 inline" /> : <ChevronDown className="w-5 h-5 inline" />}
                    </td>
                  </tr>
                  {expandedId === session.sessionId && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={8} className="p-6">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                          <EvidenceReferences session={session} />
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Verification Metrics</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <Metric label="Document Integrity" value={session.documentIntegrityScore} className={getScoreColor(session.documentIntegrityScore ?? 0)} />
                              <Metric label="Liveness Score" value={session.livenessScore} className={getScoreColor(session.livenessScore ?? 0)} />
                              <div className="bg-slate-800 p-3 rounded border border-slate-700 col-span-2 flex items-center justify-between">
                                <div className="text-sm text-slate-300">CCCD Validation</div>
                                {session.cccdValid ? <CheckCircle className="text-emerald-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">AI Recommendation</h4>
                            <div className="bg-slate-800 p-4 rounded border border-slate-700 text-sm text-slate-300">
                              {session.recommendedAction || 'Agent analysis is still pending.'}
                            </div>
                            {session.status === 'MANUAL_REVIEW' && (
                              <div className="flex gap-3 pt-2">
                                <button
                                  disabled={actionId === session.sessionId}
                                  onClick={() => void reviewSession(session, 'approve')}
                                  className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 py-2 rounded-lg font-medium disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  disabled={actionId === session.sessionId}
                                  onClick={() => void reviewSession(session, 'reject')}
                                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-2 rounded-lg font-medium disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function Metric({ label, value, className }: { label: string; value?: number; className: string }) {
  return (
    <div className="bg-slate-800 p-3 rounded border border-slate-700">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${className}`}>{(value ?? 0).toFixed(1)}%</div>
    </div>
  );
}

function EvidenceReferences({ session }: { session: KycSession }) {
  const evidence = [
    { label: 'Selfie', path: session.selfieImagePath, Icon: User },
    { label: 'ID Front', path: session.idFrontImagePath, Icon: CreditCard },
    { label: 'ID Back', path: session.idBackImagePath, Icon: CreditCard },
  ];
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Protected Evidence</h4>
      <div className="grid grid-cols-3 gap-3">
        {evidence.map(({ label, path, Icon }) => (
          <div key={label} className="min-h-24 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-xs text-slate-400 gap-2 p-3 text-center">
            <Icon className="w-7 h-7 text-slate-500" />
            <span className="font-medium">{label}</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Lock className="w-3 h-3" /> {path ? 'Reference stored' : 'Not available'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">Biometric images are not rendered in the dashboard; only protected evidence references are retained.</p>
    </div>
  );
}
