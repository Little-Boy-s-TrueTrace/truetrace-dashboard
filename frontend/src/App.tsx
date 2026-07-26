import { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, UserCheck, AlertTriangle, FileText, Activity, Clock, LogOut, User, RefreshCw, Layers } from 'lucide-react';
import { ComplianceOverview } from './components/ComplianceOverview';
import { KycVerificationCenter } from './components/KycVerificationCenter';
import { AmlAlertsDashboard } from './components/AmlAlertsDashboard';
import { StrReportManager } from './components/StrReportManager';
import { AgentMonitor } from './components/AgentMonitor';
import Login from './components/Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('activeTab') || 'overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Basic auth check
    const verify = async () => {
      try {
        const res = await fetch('/api/auth/check');
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(data.isAuthenticated);
          if (data.isAuthenticated) {
            setUser(data.username);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    verify();
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    setIsAuthenticated(false);
    setUser('');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview': return <ComplianceOverview />;
      case 'kyc': return <KycVerificationCenter />;
      case 'aml': return <AmlAlertsDashboard />;
      case 'str': return <StrReportManager />;
      case 'agents': return <AgentMonitor />;
      default: return <ComplianceOverview />;
    }
  };

  const navItems = [
    { key: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'kyc', icon: UserCheck, label: 'KYC Center' },
    { key: 'aml', icon: AlertTriangle, label: 'AML Alerts' },
    { key: 'str', icon: FileText, label: 'STR Reports' },
    { key: 'agents', icon: Activity, label: 'Agent Monitor' },
  ];

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-900 text-cyan-400">
        <RefreshCw size={24} className="animate-spin mb-3" />
        <span className="text-sm font-mono text-slate-400">INITIALIZING TRUETRACE...</span>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <Login onLoginSuccess={(username) => {
      setIsAuthenticated(true);
      setUser(username);
    }} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-300 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-all">
        {/* Logo Area */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/50">
            <Layers className="text-cyan-400" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-wide leading-tight">TrueTrace</h1>
            <div className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold">Compliance Center</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.key 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[inset_4px_0_0_0_#06b6d4]' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
              }`}
            >
              <item.icon size={18} className={activeTab === item.key ? 'text-cyan-400' : 'text-slate-500'} />
              {item.label}
            </button>
          ))}
          
          <div className="pt-8 mt-4 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <div className="text-xs font-medium text-slate-300">SYSTEM SECURED</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <Clock size={12} />
            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-900 to-slate-950">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
              ENV: PRODUCTION
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <User size={14} className="text-cyan-400" />
              <span>{user || 'Compliance Officer'}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative z-0">
          {renderActiveView()}
        </div>
      </main>

    </div>
  );
}
