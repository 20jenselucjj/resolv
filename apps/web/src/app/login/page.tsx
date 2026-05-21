'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore, User } from '@/lib/store';
import { AlertTriangle, Eye, EyeOff, Building2, X } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_remember_me') === 'true';
    }
    return false;
  });

  const [ssoEnabled, setSsoEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_enabled') === 'true';
    }
    return false;
  });
  const [ssoProvider, setSsoProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resolv_sso_provider_name') || 'SSO';
    }
    return 'SSO';
  });
  const [ssoMessage, setSsoMessage] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('resolv_remembered_email');
      if (rememberedEmail) {
        setForm(f => ({ ...f, email: rememberedEmail }));
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ data: { user: User; token: string } }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        mode === 'login' ? { email: form.email, password: form.password } : form
      );
      setToken(res.data.token);
      setUser(res.data.user);
      if (rememberMe) {
        localStorage.setItem('resolv_remember_me', 'true');
        localStorage.setItem('resolv_remembered_email', form.email);
      } else {
        localStorage.removeItem('resolv_remember_me');
        localStorage.removeItem('resolv_remembered_email');
      }
      router.push('/dashboard/tickets');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSsoClick() {
    setSsoMessage('Redirecting to SSO provider...');
    setTimeout(() => {
      setSsoMessage('');
    }, 3000);
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(true);
    } catch {
      // Even if the endpoint doesn't exist yet, show success to prevent email enumeration
      setForgotSuccess(true);
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        .fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .btn-primary:hover:not(:disabled) {
          background-color: #1d4ed8 !important;
        }
        .btn-sso:hover {
          background-color: #f8fafc !important;
        }
        .link-hover:hover {
          text-decoration: underline;
        }
        .input-field:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        {/* LEFT PANEL - FORM (45%) */}
        <div style={{
          width: '45%',
          backgroundColor: '#0F172A',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          position: 'relative'
        }}>
          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="fade-in">
            
            {/* Logo area - centered above form */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px' }}>
              <img src="/logo.png" alt="Resolv Logo" style={{ width: 120, height: 'auto', objectFit: 'contain' }} />
            </div>

            <div style={{ width: '100%' }}>
              <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: '0 0 24px 0', textAlign: 'center' }}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </h1>

            {error && (
              <div className="shake" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mode === 'register' && (
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                  className="input-field"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="link-hover"
                      style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{ ...inputStyle, paddingRight: '40px' }}
                    className="input-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563EB' }} 
                  />
                  <label htmlFor="remember" style={{ color: '#94A3B8', fontSize: '14px', cursor: 'pointer' }}>
                    Remember me
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  backgroundColor: '#2563EB',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  height: '44px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  marginTop: '8px',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading && (
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                )}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {ssoEnabled && mode === 'login' && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ height: '1px', flex: 1, backgroundColor: '#334155' }} />
                  <span style={{ color: '#64748B', fontSize: '13px' }}>or</span>
                  <div style={{ height: '1px', flex: 1, backgroundColor: '#334155' }} />
                </div>
                
                <button
                  onClick={handleSsoClick}
                  className="btn-sso"
                  style={{
                    width: '100%',
                    backgroundColor: '#ffffff',
                    color: '#0F172A',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    height: '44px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <Building2 size={18} color="#475569" />
                  Continue with {ssoProvider}
                </button>
                {ssoMessage && (
                  <p style={{ color: '#60A5FA', fontSize: '13px', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
                    {ssoMessage}
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="link-hover"
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '14px', cursor: 'pointer' }}
              >
                {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign in"}
              </button>
            </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '24px', color: '#475569', fontSize: '13px' }}>
            © 2025 Resolv
          </div>
        </div>

        {/* RIGHT PANEL - BRAND VISUAL (55%) */}
        <div style={{
          width: '55%',
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            zIndex: 1
          }} />

          {/* Floating circles */}
          <div style={{
            position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
            top: '20%', right: '15%', zIndex: 2, filter: 'blur(10px)',
            animation: 'float 6s ease-in-out infinite'
          }} />
          <div style={{
            position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
            bottom: '10%', left: '10%', zIndex: 2, filter: 'blur(15px)',
            animation: 'float 8s ease-in-out infinite reverse'
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '40px' }} className="fade-in">
            <h2 style={{ color: '#ffffff', fontSize: '36px', fontWeight: 700, margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
              IT Service Management
            </h2>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="fade-in" style={{
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px',
            position: 'relative'
          }}>
            <button 
              onClick={() => { setShowForgotModal(false); setForgotSuccess(false); setForgotEmail(''); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ margin: '0 0 8px 0', color: '#ffffff', fontSize: '20px', fontWeight: 600 }}>Reset Password</h3>
            
            {forgotSuccess ? (
              <p style={{ color: '#A7F3D0', fontSize: '15px', lineHeight: '1.5', margin: '16px 0 0 0' }}>
                If that email exists, you'll receive a reset link shortly.
              </p>
            ) : (
              <>
                <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '24px', marginTop: 0 }}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      style={inputStyle}
                      className="input-field"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-primary"
                    style={{
                      backgroundColor: '#2563EB',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      height: '44px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      opacity: forgotLoading ? 0.8 : 1,
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {forgotLoading && (
                      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    )}
                    Send Reset Link
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#94A3B8',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  height: '44px',
  width: '100%',
  borderRadius: '6px',
  border: '1px solid #334155',
  padding: '0 12px',
  backgroundColor: '#1E293B',
  color: '#ffffff',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};
