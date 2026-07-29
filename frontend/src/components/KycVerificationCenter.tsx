import React, { useEffect, useState } from 'react';
import { KycSession } from '../types';
import { Search, Filter, CheckCircle, XCircle, ChevronDown, ChevronUp, User, CreditCard, Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const KycVerificationCenter: React.FC = () => {
  const [sessions, setSessions] = useState<KycSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/kyc`)
      .then(res => res.json())
      .then(data => setSessions(data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          KYC Verification Center
        </h1>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search name or CCCD..." className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
          </div>
          <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

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
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading KYC Sessions...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">No KYC sessions found.</td></tr>
              ) : sessions.map(session => (
                <React.Fragment key={session.id}>
                  <tr className="hover:bg-slate-700/20 transition-colors group cursor-pointer" onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}>
                    <td className="p-4 font-medium text-slate-200">{session.customerName}</td>
                    <td className="p-4 text-slate-400 font-mono">{session.cccdNumber}</td>
                    <td className="p-4">{getStatusBadge(session.status)}</td>
                    <td className={`p-4 font-medium ${getScoreColor(session.deepfakeScore, true)}`}>{(session.deepfakeScore ?? 0).toFixed(1)}%</td>
                    <td className={`p-4 font-medium ${getScoreColor(session.faceMatchScore)}`}>{(session.faceMatchScore ?? 0).toFixed(1)}%</td>
                    <td className="p-4 text-slate-300">{session.riskLevel}</td>
                    <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(session.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <button className="text-slate-400 hover:text-cyan-400">
                        {expandedId === session.id ? <ChevronUp className="w-5 h-5 inline" /> : <ChevronDown className="w-5 h-5 inline" />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === session.id && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={8} className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Images</h4>
                            <div className="flex gap-4">
                              <div className="relative w-24 h-32 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-xs text-slate-400 gap-2 hover:bg-slate-700/50 transition-colors overflow-hidden group">
                                <User className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                <span className="font-medium">Selfie</span>
                                <div className="absolute top-1 right-1"><Lock className="w-3 h-3 text-slate-500" /></div>
                              </div>
                              <div className="relative w-32 h-24 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-xs text-slate-400 gap-2 hover:bg-slate-700/50 transition-colors overflow-hidden group">
                                <CreditCard className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                <span className="font-medium">ID Front</span>
                                <div className="absolute top-1 right-1"><Lock className="w-3 h-3 text-slate-500" /></div>
                              </div>
                              <div className="relative w-32 h-24 bg-slate-800/80 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-xs text-slate-400 gap-2 hover:bg-slate-700/50 transition-colors overflow-hidden group">
                                <CreditCard className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                <span className="font-medium">ID Back</span>
                                <div className="absolute top-1 right-1"><Lock className="w-3 h-3 text-slate-500" /></div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Verification Metrics</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                <div className="text-xs text-slate-500 mb-1">Document Integrity</div>
                                <div className={`text-lg font-bold ${getScoreColor(session.documentIntegrityScore)}`}>{(session.documentIntegrityScore ?? 0).toFixed(1)}%</div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                <div className="text-xs text-slate-500 mb-1">Liveness Score</div>
                                <div className={`text-lg font-bold ${getScoreColor(session.livenessScore)}`}>{(session.livenessScore ?? 0).toFixed(1)}%</div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded border border-slate-700 col-span-2 flex items-center justify-between">
                                <div className="text-sm text-slate-300">CCCD Validation</div>
                                {session.cccdValid ? <CheckCircle className="text-emerald-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">AI Recommendation</h4>
                            <div className="bg-slate-800 p-4 rounded border border-slate-700 text-sm text-slate-300">
                              {session.recommendedAction}
                            </div>
                            {session.status === 'MANUAL_REVIEW' && (
                              <div className="flex gap-3 pt-2">
                                <button onClick={() => window.alert('KYC session approved successfully.')} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 py-2 rounded-lg font-medium transition-colors">
                                  Approve
                                </button>
                                <button onClick={() => window.alert('KYC session rejected.')} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-2 rounded-lg font-medium transition-colors">
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
