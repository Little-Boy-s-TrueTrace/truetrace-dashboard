import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StrReport } from '../types';
import { Search, FileText, Send, Printer, RefreshCw, CheckCircle } from 'lucide-react';
import { apiList, apiRequest, newestFirst, normalizeStrReport } from '../api';

const POLL_INTERVAL_MS = 3000;

export const StrReportManager: React.FC = () => {
  const [reports, setReports] = useState<StrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionId, setActionId] = useState('');

  const loadReports = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const raw = await apiList<Record<string, unknown>>('/str');
      setReports(newestFirst(raw.map((item) => normalizeStrReport(item))));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load STR reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
    const timer = window.setInterval(() => void loadReports(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadReports]);

  const visibleReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reports.filter((report) => {
      const evidence = report.evidenceSummary || {};
      const matchesQuery = !normalizedQuery || [
        report.reportId,
        report.subjectFullName,
        report.subjectCccdNumber,
        evidenceAccount(evidence),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesQuery && (statusFilter === 'ALL' || report.status === statusFilter);
    });
  }, [query, reports, statusFilter]);

  const markReady = async (report: StrReport) => {
    setActionId(report.reportId);
    setMessage('');
    setError('');
    try {
      await apiRequest(`/str/${encodeURIComponent(report.reportId)}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'READY_FOR_REVIEW',
          narrativeTextVi: report.narrativeTextVi,
          narrativeTextEn: report.narrativeTextEn,
          riskLevel: report.riskLevel,
          riskScore: report.riskScore,
          evidenceSummaryJson: JSON.stringify(report.evidenceSummary || {}),
          transactionDetailsJson: JSON.stringify(report.transactionDetails || {}),
          recommendedActionsJson: JSON.stringify(report.recommendedActions || []),
          regulatoryReferencesJson: JSON.stringify(report.regulatoryReferences || []),
        }),
      });
      setMessage(`Report ${report.reportId} was reviewed and marked READY_FOR_REVIEW.`);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark this STR ready for review.');
    } finally {
      setActionId('');
    }
  };

  const submit = async (report: StrReport) => {
    setActionId(report.reportId);
    setMessage('');
    setError('');
    try {
      await apiRequest(`/str/${encodeURIComponent(report.reportId)}/submit`, { method: 'POST' });
      setMessage(`Report ${report.reportId} was submitted and the database status is now SUBMITTED.`);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit this STR.');
    } finally {
      setActionId('');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-500/20 text-slate-400',
      READY_FOR_REVIEW: 'bg-blue-500/20 text-blue-400',
      SUBMITTED: 'bg-emerald-500/20 text-emerald-400',
      ARCHIVED: 'bg-slate-800 text-slate-500',
    };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status] || 'bg-slate-500/20 text-slate-400'}`}>{status}</span>;
  };

  const getRiskColor = (level: string) => {
    if (level === 'HIGH' || level === 'CRITICAL') return 'text-red-400';
    if (level === 'MEDIUM') return 'text-yellow-400';
    return level === 'LOW' ? 'text-emerald-400' : 'text-slate-400';
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="text-cyan-400" /> STR Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">Human-reviewed workflow · newest first · refreshes every 3 seconds</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              aria-label="Search STR reports"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search report, subject, account…"
              className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            aria-label="Filter STR status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-300"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY_FOR_REVIEW">Ready for review</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
          <button
            onClick={() => void loadReports(true)}
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
        {loading && reports.length === 0 ? (
          <div className="text-center py-10 text-slate-500">Loading reports…</div>
        ) : visibleReports.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No STR reports match the current search and filter.</div>
        ) : visibleReports.map((report) => {
          const evidence = report.evidenceSummary || {};
          const subjectName = report.subjectFullName || evidenceSubjectName(evidence);
          const subjectCccd = report.subjectCccdNumber || evidenceSubjectCccd(evidence);
          const account = evidenceAccount(evidence);
          return (
            <div key={report.reportId || report.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
              <div
                className="p-5 grid grid-cols-1 md:grid-cols-6 gap-4 cursor-pointer items-center"
                onClick={() => setExpandedId(expandedId === report.reportId ? null : report.reportId)}
              >
                <div className="md:col-span-2 flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-300 font-bold">{report.reportType}</div>
                  <div>
                    <div className="text-slate-100 font-medium mb-1">{report.reportId}</div>
                    <div className="text-xs text-slate-400">{new Date(report.generatedAt).toLocaleString()}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Subject</div>
                  <div className="text-sm font-medium text-slate-300">{subjectName || account || 'Not linked'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Amount</div>
                  <div className="text-sm font-medium text-slate-300">{formatMoney(report.totalAmount, report.currency)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Risk</div>
                  <div className={`text-sm font-medium ${getRiskColor(report.riskLevel)}`}>{report.riskLevel} · {report.riskScore.toFixed(1)}/10</div>
                </div>
                <div className="text-right">{getStatusBadge(report.status)}</div>
              </div>

              {expandedId === report.reportId && (
                <div className="border-t border-slate-700/50 bg-slate-900/50 p-8">
                  <article className="str-print-area max-w-4xl mx-auto bg-slate-100 p-8 rounded-lg text-slate-800 font-serif shadow-xl">
                    <div className="text-center mb-8 border-b-2 border-slate-300 pb-4">
                      <h2 className="text-xl font-bold uppercase">Suspicious Transaction Report (STR)</h2>
                      <p className="text-sm text-slate-600 mt-2">Human-reviewed STR draft — demo, not filing-ready</p>
                      <p className="text-xs text-slate-500 mt-1">Workflow status: {report.status}</p>
                    </div>

                    <div className="space-y-6 text-sm">
                      <section>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">I. REPORT METADATA</h3>
                        <div className="grid grid-cols-2 gap-2 pl-4">
                          <div className="font-medium">Report ID:</div><div>{report.reportId}</div>
                          <div className="font-medium">Generated at:</div><div>{new Date(report.generatedAt).toLocaleString()}</div>
                          <div className="font-medium">Reviewed by:</div><div>{report.reviewedBy || 'Pending human review'}</div>
                          <div className="font-medium">Source AML alert/account:</div><div>{evidenceAlertId(evidence) || account || 'Not linked in evidence'}</div>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">II. SUSPECTED CUSTOMER INFORMATION</h3>
                        <div className="grid grid-cols-2 gap-2 pl-4">
                          <div className="font-medium">Full name:</div><div>{subjectName || 'Not provided in evidence package'}</div>
                          <div className="font-medium">ID/CCCD number:</div><div>{subjectCccd || 'Not provided in evidence package'}</div>
                          <div className="font-medium">Account number:</div><div>{account || 'Not provided in evidence package'}</div>
                          <div className="font-medium">Total flagged value:</div>
                          <div className="font-bold text-red-600">{formatMoney(report.totalAmount, report.currency)}</div>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">III. PHÂN TÍCH GIAO DỊCH ĐÁNG NGỜ (AI-GENERATED, VI)</h3>
                        <div className="pl-4 bg-slate-50 p-4 rounded border border-slate-200 text-justify leading-relaxed whitespace-pre-wrap">
                          {report.narrativeTextVi || 'Vietnamese narrative was not generated.'}
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">IV. SUSPICIOUS TRANSACTION ANALYSIS (AI-GENERATED, EN)</h3>
                        <div className="pl-4 bg-slate-50 p-4 rounded border border-slate-200 text-justify leading-relaxed whitespace-pre-wrap">
                          {report.narrativeTextEn || 'English narrative was not generated.'}
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">V. EVIDENCE & RECOMMENDED ACTIONS</h3>
                        <div className="pl-4 space-y-2">
                          <div><strong>Evidence source:</strong> {evidenceAlertId(evidence) || 'No alert identifier attached'}</div>
                          <div><strong>Recommended actions:</strong> {report.recommendedActions?.length ? report.recommendedActions.join(', ') : 'No actions attached'}</div>
                          <div><strong>Regulatory references:</strong> {report.regulatoryReferences?.length ? report.regulatoryReferences.join(', ') : 'No references attached'}</div>
                        </div>
                      </section>
                    </div>
                  </article>

                  <div className="flex flex-wrap justify-end gap-4 mt-6 max-w-4xl mx-auto">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">
                      <Printer size={18} /> Print
                    </button>
                    {report.status === 'DRAFT' && (
                      <button
                        disabled={actionId === report.reportId}
                        onClick={() => void markReady(report)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
                      >
                        <CheckCircle size={18} /> Mark Ready for Review
                      </button>
                    )}
                    {report.status === 'READY_FOR_REVIEW' && (
                      <button
                        disabled={actionId === report.reportId}
                        onClick={() => void submit(report)}
                        className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium disabled:opacity-50"
                      >
                        <Send size={18} /> Submit report
                      </button>
                    )}
                    {report.status === 'SUBMITTED' && (
                      <span className="flex items-center gap-2 px-4 py-2 text-emerald-400"><CheckCircle size={18} /> Submitted by {report.submittedBy || 'compliance officer'}</span>
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

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? value as Record<string, any> : {};

const evidenceAlert = (evidence: Record<string, unknown>) => asRecord(evidence.alert);
const evidenceKyc = (evidence: Record<string, unknown>) =>
  asRecord(evidence.kyc_data || evidence.kycData);
const evidenceAccount = (evidence: Record<string, unknown>) =>
  String(evidenceAlert(evidence).account || evidenceAlert(evidence).primaryAccountNumber || '');
const evidenceAlertId = (evidence: Record<string, unknown>) =>
  String(evidenceAlert(evidence).alert_id || evidenceAlert(evidence).alertId || '');
const evidenceSubjectName = (evidence: Record<string, unknown>) =>
  String(evidenceKyc(evidence).customer_name || evidenceKyc(evidence).customerName || '');
const evidenceSubjectCccd = (evidence: Record<string, unknown>) =>
  String(evidenceKyc(evidence).cccd_number || evidenceKyc(evidence).cccdNumber || '');
const formatMoney = (amount: number, currency = 'VND') =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
