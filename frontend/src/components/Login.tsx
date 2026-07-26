import { useState, useEffect } from 'react';
import { Layers, KeyRound, RefreshCw, Eye } from 'lucide-react';

interface Props {
  onLoginSuccess: (username: string) => void;
}

export default function Login({ onLoginSuccess }: Props) {
  const [uid, setUid] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1 = Request token, 2 = Verify token
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!otpExpiry) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((otpExpiry.getTime() - new Date().getTime()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setOtpExpiry(null);
        setErrorMsg('One-Time Token has expired. Please request a new one.');
        setStep(1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [otpExpiry]);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = uid.trim();
    if (!cleanUid) {
      setErrorMsg('Operator UID is required.');
      return;
    }
    if (!/^\d{5}$/.test(cleanUid)) {
      setErrorMsg('Operator UID must be exactly 5 digits.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: cleanUid })
      });
      const data = await res.json();
      if (res.ok) {
        setOperatorName('Compliance Officer');
        setOtpExpiry(new Date(Date.now() + 5 * 60 * 1000));
        setStep(2);
      } else {
        setErrorMsg(data.error || 'Failed to request login token.');
      }
    } catch {
      setErrorMsg('Unable to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setErrorMsg('Token is required.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid.trim(), token: token.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpExpiry(null);
        onLoginSuccess(data.username || 'Officer');
      } else {
        setErrorMsg(data.error || 'Invalid credentials.');
      }
    } catch {
      setErrorMsg('Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] flex flex-col gap-4 animate-fade-in-up">
        
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-xl p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500 rounded-t-xl" />

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/50">
              <Layers className="text-cyan-400" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-wide">
              TrueTrace <span className="text-slate-400 font-light">Compliance</span>
            </h1>
          </div>

          <p className="text-center text-sm text-slate-400 mb-8 mt-[-10px]">
            AI-Powered KYC, AML, & Regulatory Reporting
          </p>

          {step === 1 ? (
            <form onSubmit={handleRequestToken} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Operator UID
                </label>
                <input
                  type="text"
                  className="bg-slate-900/80 border border-slate-700 rounded-lg text-slate-200 px-4 py-2.5 focus:outline-none focus:border-cyan-500 w-full"
                  value={uid}
                  onChange={e => setUid(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g. 10001, 10002"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button type="submit" disabled={loading} className="mt-2 w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-lg font-medium transition-colors">
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />}
                Request Access Token
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400 uppercase">Operator Identity</span>
                <strong className="text-slate-200 text-sm">UID {uid} ({operatorName})</strong>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Secure Token
                  </label>
                  <span className="text-[10px] text-yellow-500 font-mono">
                    Expires in {secondsLeft}s
                  </span>
                </div>
                <input
                  type="text"
                  className="bg-slate-900/80 border border-slate-700 rounded-lg text-slate-200 px-4 py-2.5 focus:outline-none focus:border-cyan-500 w-full font-mono text-center text-sm"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste Token Here"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setToken(''); }} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors">
                  Back
                </button>
                <button type="submit" disabled={loading} className="flex-[2] flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-lg font-medium transition-colors">
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />}
                  Verify & Login
                </button>
              </div>
            </form>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg text-center">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-500 mt-2">
          TrueTrace Compliance Platform v1.0.0
        </div>
      </div>
    </div>
  );
}
