import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AmlAlert } from '../types';
import {
  ShieldAlert,
  Search,
  AlertTriangle,
  ArrowRight,
  Activity,
  ChevronRight,
  Clock,
  RefreshCw,
  Unlock,
  Lock,
} from 'lucide-react';
import { TransactionGraphViewer } from './TransactionGraphViewer';
import { apiList, apiRequest, newestFirst, normalizeAmlAlert } from '../api';

const POLL_INTERVAL_MS = 3000;

export const AmlAlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<AmlAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGraphId, setShowGraphId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionId, setActionId] = useState('');
  const [frozenAccounts, setFrozenAccounts] = useState<Set<string>>(new Set());

  const loadAlerts = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const raw = await apiList<Record<string, unknown>>('/aml');
      const normalized = raw.map((item) => normalizeAmlAlert(item));
      setAlerts(newestFirst(normalized));
      setFrozenAccounts(prev => {
        const next = new Set(prev);
        normalized.forEach(alert => {
          if (alert.accountStatus === 'FROZEN') {
            next.add(alert.primaryAccountNumber);
          } else if (alert.accountStatus === 'ACTIVE') {
            next.delete(alert.primaryAccountNumber);
          }
        });
        return next;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AML alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const timer = window.setInterval(() => void loadAlerts(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadAlerts]);

  const visibleAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      const matchesQuery = !normalizedQuery || [
        alert.alertId,
        alert.primaryAccountNumber,
        alert.alertType,
        alert.triggerTransactionId,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesQuery && (statusFilter === 'ALL' || alert.status === statusFilter);
    });
  }, [alerts, query, statusFilter]);

  const escalate = async (alert: AmlAlert) => {
    setActionId(alert.alertId);
    setMessage('');
    setError('');
    try {
      await apiRequest(`/aml/${encodeURIComponent(alert.alertId)}/escalate`, { method: 'POST' });
      setMessage(`Alert ${alert.alertId} was escalated. Agent 3 can now generate the STR draft.`);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to escalate this AML alert.');
    } finally {
      setActionId('');
    }
  };

  const toggleFreeze = async (accountNumber: string) => {
    const currentlyFrozen = frozenAccounts.has(accountNumber);
    const action = currentlyFrozen ? 'unfreeze' : 'freeze';
    setActionId(accountNumber);
    setMessage('');
    setError('');
    try {
      await apiRequest(`/aml/${action}/${encodeURIComponent(accountNumber)}`, { method: 'POST' });
      setFrozenAccounts(prev => {
        const next = new Set(prev);
        if (currentlyFrozen) {
          next.delete(accountNumber);
        } else {
          next.add(accountNumber);
        }
        return next;
      });
      setMessage(`Account ${accountNumber} has been ${currentlyFrozen ? 'unfrozen' : 'frozen'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} account.`);
    } finally {
      setActionId('');
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (score >= 5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-red-500/20 text-red-400',
      INVESTIGATING: 'bg-blue-500/20 text-blue-400',
      ESCALATED: 'bg-orange-500/20 text-orange-400',
      CLOSED: 'bg-slate-500/20 text-slate-400',
      FALSE_POSITIVE: 'bg-emerald-500/20 text-emerald-400',
    };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status] || 'bg-slate-500/20 text-slate-400'}`}>{status}</span>;
  };

  const formatMoney = (amount: number, currency = 'VND') =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="text-cyan-400" /> AML Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-1">Live evidence · newest first · refreshes every 3 seconds</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              aria-label="Search AML alerts"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account, alert, pattern…"
              className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            aria-label="Filter AML status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-300"
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="ESCALATED">Escalated</option>
            <option value="CLOSED">Closed</option>
          </select>
          <button
            onClick={() => void loadAlerts(true)}
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

      <div className="flex-1 overflow-auto space-y-4 pr-2">
        {loading && alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-500">Loading alerts…</div>
        ) : visibleAlerts.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No AML alerts match the current search and filter.</div>
        ) : visibleAlerts.map((alert) => {
          const findings = Array.isArray(alert.agentFinding?.findings)
            ? alert.agentFinding.findings as Array<Record<string, unknown>>
            : [];
          return (
            <div key={alert.alertId || alert.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
              <div
                className="p-5 flex flex-wrap items-center justify-between gap-5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === alert.alertId ? null : alert.alertId)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center ${getRiskColor(alert.riskScore)}`}>
                    <span className="text-[10px] font-medium uppercase">Risk /10</span>
                    <span className="text-lg font-bold leading-none">{alert.riskScore.toFixed(1)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-slate-100 font-medium">{alert.alertType.replace(/_/g, ' ')}</span>
                      {getStatusBadge(alert.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 font-mono">
                      <span className="flex items-center gap-1"><ShieldAlert size={14} className="text-slate-500" /> {alert.alertId}</span>
                      <span>Acc: <span className="text-cyan-400">{alert.primaryAccountNumber}</span></span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-sm text-slate-400 mb-1">Flagged Volume</div>
                    <div className="text-lg font-bold text-slate-200">{formatMoney(alert.totalAmount, alert.currency)}</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-sm text-slate-400 mb-1">Involved</div>
                    <div className="text-lg font-bold text-slate-200">{alert.involvedAccounts.length} Accts</div>
                  </div>
                  <ChevronRight className={`text-slate-500 transition-transform ${expandedId === alert.alertId ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {expandedId === alert.alertId && (
                <div className="border-t border-slate-700/50 bg-slate-900/50 p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Transaction Evidence</h3>
                    <div className="space-y-4">
                      {alert.transactionChain.map((tx) => (
                        <div key={tx.txId} className="relative pl-6 border-l-2 border-slate-700 pb-2">
                          <div className="absolute w-3 h-3 bg-cyan-500 rounded-full -left-[7px] top-1" />
                          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center gap-4 text-sm">
                            <div>
                              <div className="text-slate-300 font-mono flex items-center gap-2 mb-1">
                                <span className={tx.from === alert.primaryAccountNumber ? 'text-cyan-400' : ''}>{tx.from}</span>
                                <ArrowRight size={14} className="text-slate-500" />
                                <span className={tx.to === alert.primaryAccountNumber ? 'text-cyan-400' : ''}>{tx.to}</span>
                              </div>
                              <div className="text-slate-500 text-xs flex items-center gap-2">
                                <Clock size={12} /> {new Date(tx.timestamp).toLocaleString()} · {tx.channel}
                              </div>
                            </div>
                            <div className="font-medium text-slate-200">{formatMoney(tx.amount, alert.currency)}</div>
                          </div>
                        </div>
                      ))}
                      {alert.transactionChain.length === 0 && (
                        <div className="text-slate-500 text-sm italic">No transaction-chain evidence was attached to this alert.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Involved Accounts</h3>
                      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden text-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-900/50 text-slate-400">
                            <tr>
                              <th className="p-2 font-medium">Account</th>
                              <th className="p-2 font-medium">Role</th>
                              <th className="p-2 font-medium text-right">In / Out</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {alert.involvedAccounts.map((account) => (
                              <tr key={account.accountNumber}>
                                <td className="p-2 font-mono text-cyan-400">{account.accountNumber}</td>
                                <td className="p-2 text-slate-300 text-xs">{account.role}</td>
                                <td className="p-2 text-right text-slate-300">
                                  <span className="text-emerald-400">+{formatMoney(account.totalInflow, alert.currency).replace('₫', '')}</span>
                                  {' / '}
                                  <span className="text-red-400">-{formatMoney(account.totalOutflow, alert.currency).replace('₫', '')}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <h4 className="text-sm font-medium text-slate-300 mb-3">Agent Evidence Summary</h4>
                      {findings.length > 0 ? (
                        <ul className="space-y-2 text-sm text-slate-400 list-disc pl-5">
                          {findings.map((finding, index) => (
                            <li key={`${String(finding.pattern)}-${index}`}>
                              <strong className="text-slate-300">{String(finding.pattern || alert.alertType).replace(/_/g, ' ')}:</strong>{' '}
                              {typeof finding.details === 'string' ? finding.details : JSON.stringify(finding.details)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400 leading-relaxed">
                          Pattern: {alert.alertType.replace(/_/g, ' ')} · window: {alert.timeWindowSeconds}s ·
                          computed risk: {alert.riskScore.toFixed(1)}/10. No additional agent narrative was attached.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowGraphId(showGraphId === alert.alertId ? null : alert.alertId)}
                        className="flex-1 min-w-44 bg-cyan-500 hover:bg-cyan-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Activity size={16} /> {showGraphId === alert.alertId ? 'Hide Graph' : 'Investigate Graph'}
                      </button>
                      {alert.status !== 'ESCALATED' && alert.status !== 'CLOSED' && (
                        <button
                          disabled={actionId === alert.alertId}
                          onClick={() => void escalate(alert)}
                          className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/50 rounded-lg font-medium disabled:opacity-50"
                        >
                          Escalate to STR
                        </button>
                      )}
                      {(() => {
                        const isFrozen = frozenAccounts.has(alert.primaryAccountNumber);
                        return (
                          <button
                            disabled={actionId === alert.primaryAccountNumber}
                            onClick={() => void toggleFreeze(alert.primaryAccountNumber)}
                            className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 ${
                              isFrozen
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50'
                            }`}
                          >
                            {isFrozen ? <><Unlock size={16} /> Unfreeze Account</> : <><Lock size={16} /> Freeze Account</>}
                          </button>
                        );
                      })()}
                    </div>
                    {showGraphId === alert.alertId && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Transaction Flow Graph</h3>
                        <TransactionGraphViewer graphData={alert.graphData} height={350} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
