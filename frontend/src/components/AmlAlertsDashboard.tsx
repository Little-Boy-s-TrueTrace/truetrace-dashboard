import React, { useEffect, useState } from 'react';
import { AmlAlert } from '../types';
import { ShieldAlert, Search, Filter, AlertTriangle, ArrowRight, Activity, ChevronRight, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const AmlAlertsDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<AmlAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/aml`)
      .then(res => res.json())
      .then(data => setAlerts(data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status]}`}>{status}</span>;
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="text-cyan-400" /> AML Alerts
        </h1>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search accounts, alerts..." className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
          </div>
          <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-2">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No AML alerts found.</div>
        ) : alerts.map(alert => (
          <div key={alert.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
            {/* Card Header/Summary */}
            <div 
              className="p-5 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center ${getRiskColor(alert.riskScore)}`}>
                  <span className="text-xs font-medium">Risk</span>
                  <span className="text-lg font-bold leading-none">{(alert.riskScore ?? 0).toFixed(1)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-slate-100 font-medium">{alert.alertType.replace(/_/g, ' ')}</span>
                    {getStatusBadge(alert.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
                    <span className="flex items-center gap-1"><ShieldAlert size={14} className="text-slate-500"/> {alert.alertId}</span>
                    <span>Acc: <span className="text-cyan-400">{alert.primaryAccountNumber}</span></span>
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-sm text-slate-400 mb-1">Total Volume</div>
                  <div className="text-lg font-bold text-slate-200">{formatVND(alert.totalAmount)}</div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-sm text-slate-400 mb-1">Involved</div>
                  <div className="text-lg font-bold text-slate-200">{alert.involvedAccounts?.length || 0} Accts</div>
                </div>
                <ChevronRight className={`text-slate-500 transition-transform ${expandedId === alert.id ? 'rotate-90' : ''}`} />
              </div>
            </div>

            {/* Expanded Detail View */}
            {expandedId === alert.id && (
              <div className="border-t border-slate-700/50 bg-slate-900/50 p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Transaction Chain */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Transaction Chain Timeline</h3>
                  <div className="space-y-4">
                    {alert.transactionChain?.map((tx) => (
                      <div key={tx.txId} className="relative pl-6 border-l-2 border-slate-700 pb-2">
                        <div className="absolute w-3 h-3 bg-cyan-500 rounded-full -left-[7px] top-1"></div>
                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center text-sm">
                          <div>
                            <div className="text-slate-300 font-mono flex items-center gap-2 mb-1">
                              {tx.from === alert.primaryAccountNumber ? <span className="text-cyan-400">{tx.from}</span> : tx.from}
                              <ArrowRight size={14} className="text-slate-500" />
                              {tx.to === alert.primaryAccountNumber ? <span className="text-cyan-400">{tx.to}</span> : tx.to}
                            </div>
                            <div className="text-slate-500 text-xs flex items-center gap-2">
                              <Clock size={12} /> {new Date(tx.timestamp).toLocaleTimeString()} • {tx.channel}
                            </div>
                          </div>
                          <div className="font-medium text-slate-200">{formatVND(tx.amount)}</div>
                        </div>
                      </div>
                    ))}
                    {(!alert.transactionChain || alert.transactionChain.length === 0) && (
                      <div className="text-slate-500 text-sm italic">No transaction details available.</div>
                    )}
                  </div>
                </div>

                {/* Account Details & Actions */}
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
                          {alert.involvedAccounts?.map(acc => (
                            <tr key={acc.accountNumber}>
                              <td className="p-2 font-mono text-cyan-400">{acc.accountNumber}</td>
                              <td className="p-2 text-slate-300 text-xs">{acc.role}</td>
                              <td className="p-2 text-right text-slate-300">
                                <span className="text-emerald-400">+{formatVND(acc.totalInflow).replace('₫','')}</span> / <span className="text-red-400">-{formatVND(acc.totalOutflow).replace('₫','')}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Agent Analysis Summary</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Detected {alert.alertType.toLowerCase().replace(/_/g, ' ')} behavior over a {alert.timeWindowSeconds / 60}-minute window.
                      The primary account rapidly aggregated funds from {alert.involvedAccounts?.length || 0} distinct sources before attempting outbound transfers.
                      Risk score computed as {(alert.riskScore ?? 0).toFixed(1)}/10 based on transaction velocity and untrusted counterparty history.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                      <Activity size={16} /> Investigate Graph
                    </button>
                    {alert.status === 'OPEN' && (
                      <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg font-medium transition-colors">
                        Mark Investigating
                      </button>
                    )}
                    <button className="px-4 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/50 rounded-lg font-medium transition-colors">
                      Escalate to STR
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
