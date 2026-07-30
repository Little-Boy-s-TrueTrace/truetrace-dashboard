import React, { useEffect, useState } from 'react';
import { ComplianceStats, AgentStatus, AmlAlert, KycSession } from '../types';
import { Users, ShieldAlert, AlertTriangle, FileText, Lock, CheckCircle, Activity, Server } from 'lucide-react';
import { apiDate, apiList, apiRequest, formatApiTimestamp, normalizeAgentStatus, normalizeAmlAlert } from '../api';

interface AlertTypeCount {
  type: string;
  count: number;
  color: string;
  label: string;
}

export const ComplianceOverview: React.FC = () => {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [alertTypes, setAlertTypes] = useState<AlertTypeCount[]>([]);
  const [kycDaily, setKycDaily] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rawStats, rawAgents, rawAlerts, sessions] = await Promise.all([
          apiRequest<ComplianceStats>('/compliance/stats'),
          apiList<AgentStatus>('/agents/status'),
          apiList<Record<string, unknown>>('/aml'),
          apiList<KycSession>('/kyc'),
        ]);
        const normalizedApprovalRate = rawStats.totalKycProcessed > 0 && rawStats.kycApprovalRate <= 1
          ? rawStats.kycApprovalRate * 100
          : rawStats.kycApprovalRate;
        setStats({ ...rawStats, kycApprovalRate: normalizedApprovalRate });
        setAgents(rawAgents.map((agent) => ({
          ...agent,
          status: normalizeAgentStatus(agent.status),
        })));

        // Compute AML alert type breakdown from real data
        {
          const alerts: AmlAlert[] = rawAlerts.map((alert) => normalizeAmlAlert(alert));
          const typeCounts: Record<string, number> = {};
          alerts.forEach(a => {
            const t = a.alertType || 'UNKNOWN';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
          });
          const colorMap: Record<string, string> = {
            'MULE_SPLIT': 'bg-cyan-400',
            'STRUCTURING': 'bg-blue-500',
            'CIRCULAR_FLOW': 'bg-purple-500',
            'VELOCITY_ANOMALY': 'bg-amber-500',
            'RAPID_MOVEMENT': 'bg-rose-500',
            'FAN_IN': 'bg-emerald-500',
            'NEW_ACCOUNT_ABUSE': 'bg-orange-500',
            'UNKNOWN': 'bg-slate-500',
          };
          const labelMap: Record<string, string> = {
            'MULE_SPLIT': 'Mule Split',
            'STRUCTURING': 'Structuring',
            'CIRCULAR_FLOW': 'Circular Flow',
            'VELOCITY_ANOMALY': 'Velocity Anomaly',
            'RAPID_MOVEMENT': 'Rapid Movement',
            'FAN_IN': 'Fan-In',
            'NEW_ACCOUNT_ABUSE': 'New Account Abuse',
            'UNKNOWN': 'Unknown',
          };
          const total = alerts.length || 1;
          const breakdown = Object.entries(typeCounts).map(([type, count]) => ({
            type,
            count,
            color: colorMap[type] || 'bg-slate-500',
            label: `${labelMap[type] || type} (${Math.round(count / total * 100)}%)`,
          }));
          setAlertTypes(breakdown);
        }

        // Compute KYC daily from real sessions
        {
          const dailyCounts: number[] = new Array(7).fill(0);
          const now = new Date();
          if (Array.isArray(sessions)) {
            sessions.forEach((s) => {
              const d = apiDate(s.updatedAt || s.createdAt);
              const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < 7) {
                dailyCounts[6 - diffDays]++;
              }
            });
          }
          setKycDaily(dailyCounts);
        }
        setError('');
      } catch (e) {
        console.error('Failed to fetch overview data', e);
        setError(e instanceof Error ? e.message : 'Unable to refresh compliance overview.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="flex h-full items-center justify-center text-cyan-400">Loading Compliance Data...</div>;
  }

  // Compute dynamic trend text from real stats
  const kycTrend = stats?.totalKycProcessed
    ? `${stats.totalKycProcessed} total processed`
    : 'No submissions yet';
  const deepfakeTrend = stats?.deepfakesDetected
    ? `${stats.deepfakesDetected} detected`
    : 'No deepfakes found';
  const amlTrend = stats?.amlAlertsRaised
    ? `${stats.amlAlertsRaised} active alert${stats.amlAlertsRaised > 1 ? 's' : ''}`
    : 'No alerts';
  const strTrend = stats?.strReportsGenerated
    ? `${stats.strReportsGenerated} report${stats.strReportsGenerated > 1 ? 's' : ''} generated`
    : 'No reports yet';

  const StatCard = ({ title, value, icon: Icon, trend, trendColor }: { title: string, value: string | number, icon: any, trend?: string, trendColor?: string }) => (
    <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50 flex flex-col hover:border-cyan-500/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-400 font-medium">{title}</h3>
        <div className="p-2 bg-slate-800 rounded-lg text-cyan-400">
          <Icon size={20} />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-100">{value}</div>
      {trend && <div className={`text-xs mt-2 ${trendColor || 'text-emerald-400'}`}>{trend}</div>}
    </div>
  );

  // KYC chart values - use real data or show empty state
  const maxKyc = Math.max(...kycDaily, 1);
  const kycBarHeights = kycDaily.map(v => Math.max((v / maxKyc) * 100, 2));

  // AML donut - dynamic CSS conic gradient
  const donutGradient = alertTypes.length > 0
    ? (() => {
        const colorHexMap: Record<string, string> = {
          'bg-cyan-400': '#22d3ee',
          'bg-blue-500': '#3b82f6',
          'bg-purple-500': '#a855f7',
          'bg-amber-500': '#f59e0b',
          'bg-rose-500': '#f43f5e',
          'bg-emerald-500': '#10b981',
          'bg-orange-500': '#f97316',
          'bg-slate-500': '#64748b',
        };
        const total = alertTypes.reduce((s, a) => s + a.count, 0);
        let cum = 0;
        const stops = alertTypes.flatMap(a => {
          const start = cum;
          cum += (a.count / total) * 360;
          const hex = colorHexMap[a.color] || '#64748b';
          return [`${hex} ${start}deg`, `${hex} ${cum}deg`];
        });
        return `conic-gradient(${stops.join(', ')})`;
      })()
    : 'conic-gradient(#334155 0deg, #334155 360deg)';

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
        <Activity className="text-cyan-400" /> Compliance Command Center
      </h1>
      {error && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Live refresh failed: {error}. Showing the last successfully loaded values.
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="KYC Processed" value={stats?.totalKycProcessed || 0} icon={Users} trend={kycTrend} />
        <StatCard title="Deepfakes Caught" value={stats?.deepfakesDetected || 0} icon={ShieldAlert} trend={deepfakeTrend} trendColor={stats?.deepfakesDetected ? 'text-rose-400' : 'text-emerald-400'} />
        <StatCard title="AML Alerts" value={stats?.amlAlertsRaised || 0} icon={AlertTriangle} trend={amlTrend} trendColor={stats?.amlAlertsRaised ? 'text-amber-400' : 'text-emerald-400'} />
        <StatCard title="STR Reports" value={stats?.strReportsGenerated || 0} icon={FileText} trend={strTrend} />
        <StatCard title="Active Freezes" value={stats?.activeFreezes || 0} icon={Lock} trend={stats?.activeFreezes ? `${stats.activeFreezes} account${stats.activeFreezes > 1 ? 's' : ''} frozen` : 'No frozen accounts'} />
        <StatCard title="Approval Rate" value={`${(stats?.kycApprovalRate || 0).toFixed(1)}%`} icon={CheckCircle} trend={`Target: >95%`} trendColor={(stats?.kycApprovalRate || 0) >= 95 ? 'text-emerald-400' : 'text-amber-400'} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50">
          <h3 className="text-lg font-medium text-slate-200 mb-6">Daily KYC Submissions (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-48 mt-4">
            {kycBarHeights.map((pct, i) => (
              <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group">
                <div className="w-full bg-cyan-500/20 hover:bg-cyan-500/40 rounded-t-sm transition-all relative" style={{ height: `${pct}%` }}>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-slate-300">{kycDaily[i]}</div>
                </div>
                <div className="text-xs text-slate-500 mt-2">D-{6-i}</div>
              </div>
            ))}
          </div>
          {kycDaily.every(v => v === 0) && (
            <div className="text-center text-slate-500 text-sm mt-4">No KYC submissions in the last 7 days. Submit a KYC from Customer Portal to see data.</div>
          )}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50">
          <h3 className="text-lg font-medium text-slate-200 mb-6">AML Alerts by Type</h3>
          <div className="flex items-center justify-center h-48 gap-8">
            <div
              className="relative w-32 h-32 rounded-full"
              style={{ background: donutGradient }}
            >
              <div className="absolute inset-4 rounded-full bg-slate-800"></div>
              {alertTypes.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-200">{alertTypes.reduce((s, a) => s + a.count, 0)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {alertTypes.length > 0 ? alertTypes.map((at) => (
                <div key={at.type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${at.color}`}></div>
                  <span className="text-sm text-slate-400">{at.label}</span>
                </div>
              )) : (
                <span className="text-sm text-slate-500">No AML alerts yet. Alerts appear when Agent 2 detects anomalies.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agents Status */}
      <h3 className="text-xl font-medium text-slate-200 mt-8 mb-4 flex items-center gap-2"><Server size={20} className="text-cyan-400"/> AI Agent Fleet</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agents.map(agent => (
          <div key={agent.agentId} className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="font-medium text-slate-200">{agent.agentName}</div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${
                agent.status === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-400' :
                agent.status === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {agent.status}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="text-slate-500">Persisted records</div>
              <div className="text-slate-300 font-mono text-right">{agent.processedCount}</div>
            </div>
            <div className="text-xs text-slate-500 mt-2 text-right">
              Last persisted activity: {formatApiTimestamp(agent.lastActivity)}
            </div>
          </div>
        ))}
        {agents.length === 0 && [1,2,3].map(i => (
           <div key={i} className="bg-slate-800/20 p-5 rounded-xl border border-slate-700/30 animate-pulse h-32"></div>
        ))}
      </div>
    </div>
  );
};
