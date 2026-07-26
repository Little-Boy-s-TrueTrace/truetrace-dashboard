import React, { useEffect, useState } from 'react';
import { ComplianceStats, AgentStatus } from '../types';
import { Users, ShieldAlert, AlertTriangle, FileText, Lock, CheckCircle, Activity, Server } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082/api';

export const ComplianceOverview: React.FC = () => {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, agentsRes] = await Promise.all([
          fetch(`${API_URL}/compliance/stats`),
          fetch(`${API_URL}/agents/status`)
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (agentsRes.ok) setAgents(await agentsRes.json());
      } catch (e) {
        console.error('Failed to fetch overview data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="flex h-full items-center justify-center text-cyan-400">Loading Compliance Data...</div>;
  }

  const StatCard = ({ title, value, icon: Icon, trend }: { title: string, value: string | number, icon: any, trend?: string }) => (
    <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50 flex flex-col hover:border-cyan-500/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-400 font-medium">{title}</h3>
        <div className="p-2 bg-slate-800 rounded-lg text-cyan-400">
          <Icon size={20} />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-100">{value}</div>
      {trend && <div className="text-xs text-emerald-400 mt-2">{trend}</div>}
    </div>
  );

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
        <Activity className="text-cyan-400" /> Compliance Command Center
      </h1>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="KYC Processed" value={stats?.totalKycProcessed || 0} icon={Users} trend="+12% this week" />
        <StatCard title="Deepfakes Caught" value={stats?.deepfakesDetected || 0} icon={ShieldAlert} trend="+3 recent" />
        <StatCard title="AML Alerts" value={stats?.amlAlertsRaised || 0} icon={AlertTriangle} trend="High severity" />
        <StatCard title="STR Reports" value={stats?.strReportsGenerated || 0} icon={FileText} trend="2 pending review" />
        <StatCard title="Active Freezes" value={stats?.activeFreezes || 0} icon={Lock} />
        <StatCard title="Approval Rate" value={`${(stats?.kycApprovalRate || 0).toFixed(1)}%`} icon={CheckCircle} trend="Target: >95%" />
      </div>

      {/* Charts Section (Simplified CSS bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50">
          <h3 className="text-lg font-medium text-slate-200 mb-6">Daily KYC Submissions (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-48 mt-4">
            {[45, 60, 30, 80, 55, 90, 75].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                <div className="w-full bg-cyan-500/20 hover:bg-cyan-500/40 rounded-t-sm transition-all relative" style={{ height: `${val}%` }}>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs py-1 px-2 rounded">{val * 10}</div>
                </div>
                <div className="text-xs text-slate-500 mt-2">D-{6-i}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl border border-slate-700/50">
          <h3 className="text-lg font-medium text-slate-200 mb-6">AML Alerts by Type</h3>
          <div className="flex items-center justify-center h-48 gap-8">
            <div className="relative w-32 h-32 rounded-full border-[16px] border-slate-700 border-t-cyan-400 border-r-blue-500 border-b-purple-500"></div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div><span className="text-sm text-slate-400">Mule Split (45%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-sm text-slate-400">Structuring (30%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="text-sm text-slate-400">Circular Flow (25%)</span></div>
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
              <div className="text-slate-500">Processed</div>
              <div className="text-slate-300 font-mono text-right">{agent.processedCount}</div>
              <div className="text-slate-500">Errors</div>
              <div className="text-slate-300 font-mono text-right">{agent.errorCount}</div>
              <div className="text-slate-500">Queue Depth</div>
              <div className="text-slate-300 font-mono text-right">{agent.queueDepth}</div>
            </div>
            <div className="text-xs text-slate-500 mt-2 text-right">
              Last active: {new Date(agent.lastActivity).toLocaleTimeString()}
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
