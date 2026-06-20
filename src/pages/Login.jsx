import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { AppContext } from '../context/AppContext';
import { Shield, BarChart2, Truck, ArrowRight, CheckCircle, Settings } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Admin', username: 'admin1', password: 'Admin@123', Icon: Shield, color: '#8b5cf6', desc: 'Registry CRUD + Vehicle Admin' },
  { role: 'Manager', username: 'manager1', password: 'Manager@123', Icon: BarChart2, color: '#3b82f6', desc: 'Dashboard + Request Approvals' },
  { role: 'Driver', username: 'driver1', password: 'Driver@123', Icon: Truck, color: '#10b981', desc: 'View assigned vehicles + Tasks' },
];

const Login = () => {
  const navigate = useNavigate();
  const { dispatch } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (isLogin) {
        const res = await authAPI.login({ username: formData.username, password: formData.password });
        localStorage.setItem('username', res.data.username);
        localStorage.setItem('role', res.data.role);
        dispatch({ type: 'LOGIN', payload: { username: res.data.username, role: res.data.role } });
        const role = res.data.role;
        if (role === 'ADMIN' || role === 'ROLE_ADMIN') navigate('/admin');
        else if (role === 'MANAGER' || role === 'ROLE_MANAGER') navigate('/dashboard');
        else navigate('/vehicles');
      } else {
        await authAPI.register(formData);
        setIsLogin(true);
        setSuccessMsg('Account created! You can now log in.');
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setFormData({ ...formData, username: account.username, password: account.password });
    setError('');
  };

  return (
    <div className="login-container" style={{
      minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: 'var(--bg-color)',
    }}>
      {/* Left panel — branding */}
      <div className="login-branding" style={{
        flex: '1 1 400px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
        padding: '4rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '2rem',
            fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600, letterSpacing: '0.05em',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Enterprise Platforms Demo
          </div>

          <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem', color: '#fff' }}>
            Fleet<span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ops</span><br />
            <span style={{ fontSize: '1.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>Enterprise Platform</span>
          </h1>

          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '380px' }}>
            A production-grade fleet management system. Every feature maps directly to a high-availability microservice node.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2.5rem' }}>
            {['Cache','Events','Audit Logs','Security','Cryptography','Alerts','Storage','Compute'].map(s => (
              <span key={s} style={{
                padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.65)',
              }}>{s}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '2rem' }}>
            {[['5', 'Microservices'], ['19+', 'Core Components'], ['4', 'Databases']].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818cf8' }}>{v}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-form-container" style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 2rem', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {isLogin ? 'Sign in' : 'Create account'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isLogin ? 'Access the FleetOps Enterprise platform' : 'Register a new account'}
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(16,185,129,0.25)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} strokeWidth={2} />{successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Username</label>
              <input id="login-username" type="text" required placeholder="e.g. admin1" value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })} style={{ width: '100%' }} />
            </div>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</label>
                <input type="email" required placeholder="your@email.com" value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%' }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Password</label>
              <input id="login-password" type="password" required placeholder="••••••••" value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })} style={{ width: '100%' }} />
            </div>
            <button id="login-submit" type="submit" className="btn-primary" disabled={loading}
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loading ? 'Authenticating...' : <>{isLogin ? 'Sign in' : 'Create Account'}<ArrowRight size={16} strokeWidth={2} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button type="button" style={{ background: 'none', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.875rem' }}
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {isLogin && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Demo Accounts</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {DEMO_ACCOUNTS.map(acc => {
                  const Icon = acc.Icon;
                  return (
                    <button key={acc.role} type="button" onClick={() => fillDemo(acc)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 0.875rem', background: 'var(--bg-surface)',
                        border: '1px solid var(--glass-border)', borderRadius: '8px',
                        cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = acc.color + '80'; e.currentTarget.style.background = acc.color + '10'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: acc.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${acc.color}30` }}>
                        <Icon size={16} strokeWidth={2} color={acc.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: acc.color }}>{acc.role}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.desc}</div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{acc.username}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
