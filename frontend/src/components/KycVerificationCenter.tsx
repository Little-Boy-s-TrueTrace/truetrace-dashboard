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
  Bot,
  BarChart3,
  Eye,
} from 'lucide-react';
import { apiList, apiRequest, formatApiTimestamp, newestFirst, parseJson } from '../api';

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
  const [reviewMode, setReviewMode] = useState<'agent' | 'manual'>('agent');

  const loadSessions = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiList<KycSession & { agentFindingJson?: string }>('/kyc');
      const parsed = data.map((s: any) => ({
        ...s,
        agentFinding: parseJson<KycSession['agentFinding']>(s.agentFindingJson || s.agentFinding, undefined),
      }));
      setSessions(newestFirst(parsed));
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
                    <td className="p-4 text-slate-400 whitespace-nowrap">{formatApiTimestamp(session.updatedAt || session.createdAt)}</td>
                    <td className="p-4 text-right">
                      {expandedId === session.sessionId ? <ChevronUp className="w-5 h-5 inline" /> : <ChevronDown className="w-5 h-5 inline" />}
                    </td>
                  </tr>
                  {expandedId === session.sessionId && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={8} className="p-6">
                        <div className="flex flex-col gap-6">
                          {/* Review Mode Toggle */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => setReviewMode(reviewMode === 'agent' ? 'manual' : 'agent')}
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                                reviewMode === 'manual' 
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {reviewMode === 'manual' ? <><Eye className="w-4 h-4" /> Manual Review Mode</> : <><BarChart3 className="w-4 h-4" /> Agent Analysis</>}
                            </button>
                          </div>

                          {reviewMode === 'manual' ? (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Column 1: Selfie */}
                                <div className="flex flex-col gap-2">
                                  <h4 className="text-sm font-medium text-slate-300">Selfie / Ảnh chân dung</h4>
                                  <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-2 flex items-center justify-center min-h-[300px]">
                                    <img 
                                      src={`/api/kyc/${session.sessionId}/evidence/selfie`} 
                                      alt="Selfie" 
                                      loading="lazy"
                                      className="max-h-[400px] w-full object-contain rounded-lg border border-slate-700/50 shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(`/api/kyc/${session.sessionId}/evidence/selfie`, '_blank')}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                          const span = document.createElement('span');
                                          span.className = 'text-slate-500 text-sm';
                                          span.innerText = 'Ảnh không khả dụng';
                                          target.parentElement.appendChild(span);
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                {/* Column 2: ID Front */}
                                <div className="flex flex-col gap-2">
                                  <h4 className="text-sm font-medium text-slate-300">CCCD Mặt trước</h4>
                                  <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-2 flex items-center justify-center min-h-[300px]">
                                    <img 
                                      src={`/api/kyc/${session.sessionId}/evidence/id-front`} 
                                      alt="ID Front" 
                                      loading="lazy"
                                      className="max-h-[400px] w-full object-contain rounded-lg border border-slate-700/50 shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(`/api/kyc/${session.sessionId}/evidence/id-front`, '_blank')}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                          const span = document.createElement('span');
                                          span.className = 'text-slate-500 text-sm';
                                          span.innerText = 'Ảnh không khả dụng';
                                          target.parentElement.appendChild(span);
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                {/* Column 3: ID Back */}
                                <div className="flex flex-col gap-2">
                                  <h4 className="text-sm font-medium text-slate-300">CCCD Mặt sau</h4>
                                  <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-2 flex items-center justify-center min-h-[300px]">
                                    <img 
                                      src={`/api/kyc/${session.sessionId}/evidence/id-back`} 
                                      alt="ID Back" 
                                      loading="lazy"
                                      className="max-h-[400px] w-full object-contain rounded-lg border border-slate-700/50 shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(`/api/kyc/${session.sessionId}/evidence/id-back`, '_blank')}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                          const span = document.createElement('span');
                                          span.className = 'text-slate-500 text-sm';
                                          span.innerText = 'Ảnh không khả dụng';
                                          target.parentElement.appendChild(span);
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="text-sm">
                                  <div className="text-slate-400">Customer: <span className="text-slate-200 font-medium">{session.customerName || 'N/A'}</span></div>
                                  <div className="text-slate-400">CCCD Number: <span className="text-slate-200 font-mono">{session.cccdNumber || 'N/A'}</span></div>
                                  <div className="text-slate-400">Session ID: <span className="text-slate-200 font-mono">{session.sessionId}</span></div>
                                </div>
                                
                                {session.status === 'MANUAL_REVIEW' && (
                                  <div className="flex gap-3 w-full md:w-auto">
                                    <button
                                      disabled={actionId === session.sessionId}
                                      onClick={() => void reviewSession(session, 'approve')}
                                      className="flex-1 md:flex-none px-6 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold disabled:opacity-50 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      disabled={actionId === session.sessionId}
                                      onClick={() => void reviewSession(session, 'reject')}
                                      className="flex-1 md:flex-none px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg font-bold disabled:opacity-50 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Agent Analysis Status Banner */}
                              {session.agentFinding ? (
                            <div className={`flex items-center gap-3 p-4 rounded-lg border ${session.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30' : session.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                              <Bot className="w-6 h-6 text-cyan-400" />
                              <div className="flex-1">
                                <h3 className={`font-semibold ${session.status === 'APPROVED' ? 'text-emerald-400' : session.status === 'REJECTED' ? 'text-red-400' : 'text-orange-400'}`}>Deepfake Inspector Agent — Analysis Complete</h3>
                                <p className="text-xs text-slate-400">Analysis completed at {formatApiTimestamp(session.agentFinding.timestamp || session.updatedAt || session.createdAt || '')}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
                              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                              <div className="flex-1">
                                <h3 className="font-semibold text-blue-400">Agent is processing...</h3>
                                <p className="text-xs text-slate-400">Awaiting deepfake detection and CCCD validation results</p>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Vision Analysis Panel */}
                            <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-4 space-y-4">
                              <h4 className="text-sm font-medium text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                <Search className="w-4 h-4" /> Vision Analysis
                              </h4>
                              {session.agentFinding?.vision_analysis ? (
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-300">Deepfake Probability</span>
                                      <span className="text-slate-300 font-mono">{((session.agentFinding.vision_analysis.deepfake_probability || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full ${(session.agentFinding.vision_analysis.deepfake_probability || 0) > 0.7 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`} style={{ width: `${(session.agentFinding.vision_analysis.deepfake_probability || 0) * 100}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-300">Face Match Score</span>
                                      <span className="text-slate-300 font-mono">{((session.agentFinding.vision_analysis.face_match_score || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full ${(session.agentFinding.vision_analysis.face_match_score || 0) > 0.8 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`} style={{ width: `${(session.agentFinding.vision_analysis.face_match_score || 0) * 100}%` }}></div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-300">Liveness Score</span>
                                      <span className="text-slate-300 font-mono">{((session.agentFinding.vision_analysis.liveness_score || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full ${(session.agentFinding.vision_analysis.liveness_score || 0) > 0.8 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`} style={{ width: `${(session.agentFinding.vision_analysis.liveness_score || 0) * 100}%` }}></div>
                                    </div>
                                  </div>
                                  {session.agentFinding.vision_analysis.signals && session.agentFinding.vision_analysis.signals.length > 0 && (
                                    <div className="pt-2">
                                      <div className="text-xs text-slate-400 mb-1">Detection Signals:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {session.agentFinding.vision_analysis.signals.map(signal => (
                                          <span key={signal} className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-mono">{signal}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-500 mt-2 text-right">Provider: {session.agentFinding.vision_analysis.provider}</div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-500 italic">Analysis data not available.</div>
                              )}
                            </div>

                            {/* CCCD & AI Summary */}
                            <div className="flex flex-col gap-6">
                              <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-4">
                                <h4 className="text-sm font-medium text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" /> CCCD Validation
                                </h4>
                                {session.agentFinding?.cccd_validation ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      {session.agentFinding.cccd_validation.valid ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                                      <span className={`text-sm font-medium ${session.agentFinding.cccd_validation.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {session.agentFinding.cccd_validation.valid ? 'Document Validated' : 'Validation Failed'}
                                      </span>
                                    </div>
                                    {session.agentFinding.cccd_validation.valid ? (
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="bg-slate-900/50 p-2 rounded">
                                          <div className="text-[10px] text-slate-500 uppercase">Province</div>
                                          <div className="text-xs text-slate-300 truncate">{session.agentFinding.cccd_validation.province}</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded">
                                          <div className="text-[10px] text-slate-500 uppercase">Gender</div>
                                          <div className="text-xs text-slate-300">{session.agentFinding.cccd_validation.gender}</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded col-span-2">
                                          <div className="text-[10px] text-slate-500 uppercase">Birth Year</div>
                                          <div className="text-xs text-slate-300">{session.agentFinding.cccd_validation.birth_year}</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                                        Error: {session.agentFinding.cccd_validation.error || 'Unknown error'}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-500 italic">Validation data not available.</div>
                                )}
                              </div>
                              
                              <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-4 flex-1">
                                <h4 className="text-sm font-medium text-cyan-400 uppercase tracking-wider mb-2">AI Decision Summary</h4>
                                <div className="text-sm text-slate-300">
                                  {session.agentFinding?.vision_analysis ? (
                                    session.status === 'APPROVED' ? (
                                      <span className="text-emerald-300">All biometric checks passed. Identity verified. Agent automatically approved onboarding.</span>
                                    ) : session.status === 'REJECTED' ? (
                                      <span className="text-red-300">
                                        High deepfake probability detected ({((session.agentFinding.vision_analysis.deepfake_probability || 0) * 100).toFixed(0)}%). 
                                        Low face match ({((session.agentFinding.vision_analysis.face_match_score || 0) * 100).toFixed(0)}%) and 
                                        liveness ({((session.agentFinding.vision_analysis.liveness_score || 0) * 100).toFixed(0)}%). 
                                        Agent automatically rejected.
                                      </span>
                                    ) : (
                                      <span className="text-orange-300">Agent flags require manual review. Please inspect evidence.</span>
                                    )
                                  ) : (
                                    <span className="text-slate-400">Agent analysis pending.</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Evidence & Action */}
                            <div className="flex flex-col gap-6">
                              <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-4">
                                <h4 className="text-sm font-medium text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Lock className="w-4 h-4" /> Evidence Integrity
                                </h4>
                                {session.agentFinding?.evidence ? (
                                  <div className="space-y-2">
                                    {Object.entries(session.agentFinding.evidence).map(([key, data]) => (
                                      <div key={key} className="bg-slate-900/50 p-2 rounded flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {key === 'selfie' ? <User className="w-4 h-4 text-slate-400" /> : <CreditCard className="w-4 h-4 text-slate-400" />}
                                          <div className="text-xs font-medium text-slate-300 capitalize">{key.replace('_', ' ')}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-[10px] text-slate-400">
                                            {data.present ? (
                                              <span className="text-emerald-400 flex items-center gap-1 justify-end"><CheckCircle className="w-3 h-3" /> Present ({((data.byte_size || 0) / 1024).toFixed(1)} KB)</span>
                                            ) : (
                                              <span className="text-red-400 flex items-center gap-1 justify-end"><XCircle className="w-3 h-3" /> Missing</span>
                                            )}
                                          </div>
                                          {data.present && data.sha256 && (
                                            <div className="text-[9px] text-slate-500 font-mono mt-0.5" title={data.sha256}>
                                              SHA: {data.sha256.substring(0, 12)}...
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <EvidenceReferences session={session} />
                                )}
                              </div>

                              {session.status === 'MANUAL_REVIEW' && (
                                <div className="mt-auto">
                                  <div className="flex gap-3">
                                    <button
                                      disabled={actionId === session.sessionId}
                                      onClick={() => void reviewSession(session, 'approve')}
                                      className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      disabled={actionId === session.sessionId}
                                      onClick={() => void reviewSession(session, 'reject')}
                                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          </>
                          )}
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
