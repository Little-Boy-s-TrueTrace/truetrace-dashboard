import React, { useEffect, useState } from 'react';
import { StrReport } from '../types';
import { Search, Filter, FileText, Send, Printer, FileDown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const StrReportManager: React.FC = () => {
  const [reports, setReports] = useState<StrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/str`)
      .then(res => res.json())
      .then(data => setReports(data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-500/20 text-slate-400',
      READY_FOR_REVIEW: 'bg-blue-500/20 text-blue-400',
      SUBMITTED: 'bg-emerald-500/20 text-emerald-400',
      ARCHIVED: 'bg-slate-800 text-slate-500',
    };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status]}`}>{status}</span>;
  };

  const getRiskColor = (level: string) => {
    if (level === 'HIGH' || level === 'CRITICAL') return 'text-red-400';
    if (level === 'MEDIUM') return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileText className="text-cyan-400" /> STR Reports
        </h1>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search report ID, name..." className="bg-slate-800 border border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
          </div>
          <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-2">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No STR reports found.</div>
        ) : reports.map(report => (
          <div key={report.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
            
            {/* Card Header/Summary */}
            <div 
              className="p-5 grid grid-cols-1 md:grid-cols-6 gap-4 cursor-pointer items-center"
              onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
            >
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                  {report.reportType}
                </div>
                <div>
                  <div className="text-slate-100 font-medium mb-1">{report.reportId}</div>
                  <div className="text-xs text-slate-400">{new Date(report.generatedAt).toLocaleString()}</div>
                </div>
              </div>
              
              <div className="md:col-span-1">
                <div className="text-xs text-slate-500 mb-1">Subject</div>
                <div className="text-sm font-medium text-slate-300">{report.subjectFullName}</div>
              </div>

              <div className="md:col-span-1">
                <div className="text-xs text-slate-500 mb-1">Amount</div>
                <div className="text-sm font-medium text-slate-300">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(report.totalAmount)}
                </div>
              </div>

              <div className="md:col-span-1">
                <div className="text-xs text-slate-500 mb-1">Risk Level</div>
                <div className={`text-sm font-medium ${getRiskColor(report.riskLevel)}`}>{report.riskLevel}</div>
              </div>

              <div className="md:col-span-1 text-right">
                {getStatusBadge(report.status)}
              </div>
            </div>

            {/* Expanded Form View */}
            {expandedId === report.id && (
              <div className="border-t border-slate-700/50 bg-slate-900/50 p-8">
                
                <div className="max-w-4xl mx-auto bg-slate-100 p-8 rounded-lg text-slate-800 font-serif shadow-xl">
                  {/* Official Header */}
                  <div className="text-center mb-8 border-b-2 border-slate-300 pb-4">
                    <h2 className="text-xl font-bold uppercase">SUSPICIOUS TRANSACTION REPORT (STR)</h2>
                    <p className="text-sm text-slate-600 mt-2">To: Anti-Money Laundering Department - State Bank of Vietnam</p>
                  </div>

                  <div className="space-y-6 text-sm">
                    {/* Section 1 */}
                    <section>
                      <h3 className="font-bold text-lg mb-2 text-slate-900">I. REPORTING ORGANIZATION INFORMATION</h3>
                      <div className="grid grid-cols-2 gap-2 pl-4">
                        <div className="font-medium">Organization name:</div><div>TrueTrace Commercial Bank</div>
                        <div className="font-medium">Tax code:</div><div>0100123456</div>
                        <div className="font-medium">Report prepared by:</div><div>AI System - TrueTrace Command Center</div>
                      </div>
                    </section>

                    {/* Section 2 */}
                    <section>
                      <h3 className="font-bold text-lg mb-2 text-slate-900">II. SUSPECTED CUSTOMER INFORMATION</h3>
                      <div className="grid grid-cols-2 gap-2 pl-4">
                        <div className="font-medium">Full name:</div><div>{report.subjectFullName}</div>
                        <div className="font-medium">ID/CCCD number:</div><div>{report.subjectCccdNumber}</div>
                        <div className="font-medium">Total transaction value:</div>
                        <div className="font-bold text-red-600">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(report.totalAmount)}
                        </div>
                      </div>
                    </section>

                    {/* Section 3 */}
                    <section>
                      <h3 className="font-bold text-lg mb-2 text-slate-900">III. TRANSACTION DESCRIPTION AND ANALYSIS (AI-Generated)</h3>
                      <div className="pl-4 bg-slate-50 p-4 rounded border border-slate-200 text-justify leading-relaxed whitespace-pre-wrap">
                        {report.narrativeTextVi}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6 max-w-4xl mx-auto">
                  <button onClick={() => window.alert('PDF exported successfully.')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors">
                    <FileDown size={18} /> Export PDF
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors">
                    <Printer size={18} /> Print
                  </button>
                  {report.status === 'READY_FOR_REVIEW' && (
                    <button onClick={() => window.alert('Report submitted to State Bank of Vietnam.')} className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors shadow-lg shadow-cyan-500/20">
                      <Send size={18} /> Submit to SBV
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
