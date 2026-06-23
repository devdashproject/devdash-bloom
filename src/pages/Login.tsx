import { useState } from 'react';
import { ArrowRight, Flower2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginWithToken } = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setError('');
    setBusy(true);
    const ok = await loginWithToken(token.trim());
    if (!ok) setError('That seed did not take. Check the token.');
    setBusy(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(1000px 700px at 50% 120%, #3a3b6b 0%, #141a3a 45%, #0b1026 100%)' }}
    >
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-9">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <Flower2 className="w-8 h-8 text-petal-pink" />
            <h1 className="text-4xl font-extrabold text-gradient tracking-tight">Bloom</h1>
          </div>
          <p className="text-white/40 text-sm">plant a token, watch your work grow</p>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-7 shadow-bloom space-y-5">
          <div>
            <label className="text-white/50 text-xs font-semibold block mb-2 tracking-wide uppercase">API Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="dd_…"
              autoFocus
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20
                focus:outline-none focus:border-petal-pink/50 focus:ring-2 focus:ring-petal-pink/15 transition-all text-sm"
            />
          </div>
          {error && <p className="text-petal-coral text-xs">{error}</p>}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-semibold
              text-dusk-900 bg-gradient-to-r from-petal-pink via-petal-gold to-petal-violet shadow-bloom
              hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {busy ? 'Planting…' : 'Enter the garden'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="text-white/30 text-[11px] text-center leading-relaxed">
            Generate one with <code className="text-white/45">devdash token create</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
