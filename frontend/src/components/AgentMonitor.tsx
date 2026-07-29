import React, { useEffect, useState } from 'react';
import { AgentStatus } from '../types';
import { Server, Activity, ArrowRight, Zap, RefreshCw, Cpu, Database, Network, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const AgentMonitor: React.FC = () => {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for the modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedAgentLogs, setSelectedAgentLogs] = useState<{agentId: string, logs: string[]} | null>(null);

  useEffect(() => {
    const fetchAgents = () => {
      fetch(`${API_URL}/agents/status`)
        .then(res => res.json())
        .then(data => setAgents(data || []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    };
    
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const getAgentIcon = (name: string) => {
    if (name.includes('KYC')) return <Zap className="w-8 h-8 text-cyan-400" />;
    if (name.includes('Transactions')) return <Activity className="w-8 h-8 text-purple-400" />;
    if (name.includes('Report')) return <Database className="w-8 h-8 text-emerald-400" />;
    return <Server className="w-8 h-8 text-slate-400" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'RUNNING') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (status === 'ERROR') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-8 overflow-y-auto relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Cpu className="text-cyan-400" /> AI Agent Monitor
        </h1>
        <button onClick={() => window.alert('Force sync initiated.')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400">
          <RefreshCw size={16} /> Force Sync
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && agents.length === 0 ? (
          [1,2,3].map(i => <div key={i} className="bg-slate-800/50 rounded-xl h-64 animate-pulse border border-slate-700/50"></div>)
        ) : agents.map(agent => (
          <div key={agent.agentId} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 relative overflow-hidden group">
            {/* Background glow effect based on status */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${
              agent.status === 'RUNNING' ? 'bg-emerald-500' : agent.status === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                  {getAgentIcon(agent.agentName)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{agent.agentName}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-1">{agent.agentId}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`}></div>
                <span className="text-xs font-bold text-slate-300">{agent.status}</span>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Items Processed</div>
                  <div className="text-2xl font-mono text-slate-200">{agent.processedCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Queue Depth</div>
                  <div className="text-2xl font-mono text-cyan-400">{agent.queueDepth}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Error Count</div>
                  <div className={`text-xl font-mono ${agent.errorCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{agent.errorCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Last Activity</div>
                  <div className="text-sm text-slate-300 mt-1">{new Date(agent.lastActivity).toLocaleTimeString()}</div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => {
                    fetch(`${API_URL}/agents/${agent.agentId}/logs`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.logs) {
                          setSelectedAgentLogs({ agentId: agent.agentId, logs: data.logs });
                          setIsLogModalOpen(true);
                        } else {
                          window.alert(data.error || 'Failed to fetch logs');
                        }
                      })
                      .catch(err => window.alert('Error fetching logs'));
                  }} 
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                >
                  View Logs
                </button>
                <button 
                  onClick={() => {
                    fetch(`${API_URL}/agents/${agent.agentId}/restart`, { method: 'POST' })
                      .then(res => res.json())
                      .then(data => {
                        window.alert(data.message || data.error || 'Restart command sent');
                      })
                      .catch(err => window.alert('Error sending restart command'));
                  }} 
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                >
                  Restart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Visualization */}
      <div className="mt-8 bg-slate-800/40 border border-slate-700/50 rounded-xl p-8">
        <h3 className="text-lg font-medium text-slate-200 mb-8 flex items-center gap-2">
          <Network className="text-cyan-400"/> Data Processing Pipeline
        </h3>
        
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto gap-4">
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400">Inputs</div>
            <div className="text-xs text-slate-500">Raw Data</div>
          </div>

          <ArrowRight className="text-cyan-500/50 hidden md:block" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-32 py-4 bg-slate-700/50 border border-cyan-500/30 rounded-lg text-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <Zap className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-200">Agent 1</div>
              <div className="text-xs text-slate-400">KYC/Deepfake</div>
            </div>
          </div>

          <ArrowRight className="text-purple-500/50 hidden md:block" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-32 py-4 bg-slate-700/50 border border-purple-500/30 rounded-lg text-center shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <Activity className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-200">Agent 2</div>
              <div className="text-xs text-slate-400">AML/Graphs</div>
            </div>
          </div>

          <ArrowRight className="text-emerald-500/50 hidden md:block" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-32 py-4 bg-slate-700/50 border border-emerald-500/30 rounded-lg text-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Database className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-200">Agent 3</div>
              <div className="text-xs text-slate-400">STR Generation</div>
            </div>
          </div>

          <ArrowRight className="text-slate-500/50 hidden md:block" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full border-2 border-solid border-slate-600 bg-slate-800 flex items-center justify-center text-slate-300 text-center text-xs p-2">Command<br/>Center</div>
            <div className="text-xs text-slate-500">Dashboard</div>
          </div>

        </div>
      </div>

      {/* Logs Modal */}
      {isLogModalOpen && selectedAgentLogs && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/80">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Activity className="text-cyan-400 w-5 h-5" />
                Logs: {selectedAgentLogs.agentId}
              </h3>
              <button 
                onClick={() => { setIsLogModalOpen(false); setSelectedAgentLogs(null); }}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-slate-900 overflow-y-auto max-h-[60vh]">
              {selectedAgentLogs.logs.length > 0 ? (
                <div className="font-mono text-sm text-slate-300 space-y-1">
                  {selectedAgentLogs.logs.map((log, i) => (
                    <div key={i} className="break-all">{log}</div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 italic">No logs available.</div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end">
              <button 
                onClick={() => { setIsLogModalOpen(false); setSelectedAgentLogs(null); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
