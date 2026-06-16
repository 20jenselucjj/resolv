'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { api, getToken, setToken } from '@/lib/api';
import { useStore, User } from '@/lib/store';
import { AlertTriangle, Eye, EyeOff, Building2, X } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProvider, setSsoProvider] = useState('SSO');
  const [ssoConfigLoading, setSsoConfigLoading] = useState(true);

  // Login mode state: 'both' | 'sso_only' | 'password_only'
  const [loginMode, setLoginMode] = useState<'both' | 'sso_only' | 'password_only'>('both');
  const [emergencyKey, setEmergencyKey] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotResetLink, setForgotResetLink] = useState<string | null>(null);
  const [forgotEmailSent, setForgotEmailSent] = useState(true);
  const [forgotFallbackMessage, setForgotFallbackMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('resolv_remembered_email');
      if (rememberedEmail) {
        queueMicrotask(() => setForm(f => ({ ...f, email: rememberedEmail })));
      }
    }
  }, []);

  // Fetch SSO/OAuth config from backend (replaces localStorage stub)
  useEffect(() => {
    async function fetchSsoConfig() {
      try {
        const res = await api.get<{ data: { enabled: boolean; provider: string | null; provider_name: string | null; login_mode: string; has_emergency_bypass: boolean } }>('/auth/oauth/config');
        if (res.data?.enabled) {
          setSsoEnabled(true);
          setSsoProvider(res.data.provider_name || 'SSO');
        } else {
          setSsoEnabled(false);
        }
        // Read login mode from config
        if (res.data?.login_mode) {
          setLoginMode(res.data.login_mode as 'both' | 'sso_only' | 'password_only');
        }
      } catch {
        setSsoEnabled(false);
      } finally {
        setSsoConfigLoading(false);
      }
    }
    fetchSsoConfig();
  }, []);

  // Auto-redirect state for SSO-only mode
  const [autoRedirecting, setAutoRedirecting] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Extract emergency key from URL params (for SSO-only bypass)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const emergency = searchParams?.get('emergency');
    if (emergency) {
      queueMicrotask(() => {
        setEmergencyKey(emergency);
        // Clean URL to keep the key hidden
        router.replace('/login');
      });
    }
  }, [searchParams, router]);

  // Auto-redirect to SSO when login_mode is sso_only and no emergency key
  useEffect(() => {
    if (ssoConfigLoading) return;
    if (loginMode !== 'sso_only') return;
    if (emergencyKey) return;

    // Check if user explicitly chose to cancel auto-redirect in this session
    const cancelled = sessionStorage.getItem('resolv_sso_auto_cancelled');
    if (cancelled === 'true') return;

    // Check if we already have a valid token (user just logged out or session expired)
    const existingToken = getToken();
    if (existingToken) {
      // Token exists but might be expired — try it first
      return;
    }

    queueMicrotask(() => setAutoRedirecting(true));
    const timer = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-redirect after countdown
    const redirectTimer = setTimeout(() => {
      sessionStorage.setItem('resolv_sso_auto_cancelled', 'false');
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/oauth/google/authorize`;
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [ssoConfigLoading, loginMode, emergencyKey]);

  // Handle OAuth callback (token or error in URL params)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = searchParams?.get('token');
    const errorCode = searchParams?.get('error');

    if (token) {
      // Store the token and redirect — the /auth/me call will populate user data
      setToken(token);
      // Fetch user data with the new token
      api.get<{ data: User }>('/auth/me')
        .then(res => {
          setUser(res.data);
          if (res.data.passwordResetRequired) {
            router.replace('/force-password-change');
          } else {
            router.replace(res.data.role === 'user' ? '/dashboard/portal' : '/dashboard/tickets');
          }
        })
        .catch(() => {
          setError('SSO login succeeded but failed to load profile. Please try again.');
        });
      return;
    }

    if (errorCode) {
      const errorMessages: Record<string, string> = {
        sso_not_configured: 'SSO is not configured. Please contact your administrator.',
        sso_config_error: 'SSO configuration is invalid.',
        sso_denied: 'You denied the SSO login request.',
        sso_invalid: 'The SSO login request was invalid. Please try again.',
        sso_expired: 'The SSO login request has expired. Please try again.',
        sso_token_failed: 'SSO token exchange failed.',
        sso_no_id_token: 'No identity token received from SSO provider.',
        sso_no_email: 'Could not retrieve your email from the SSO provider.',
        sso_account_disabled: 'Your account has been disabled. Please contact your administrator.',
        sso_error: 'An SSO error occurred. Please try again.',
        sso_disabled: 'SSO sign-in is currently disabled. Please sign in with your email and password.',
      };

      // Check for a detailed error message from the backend
      const errorDetail = searchParams?.get('error_detail');
      const baseMsg = errorMessages[errorCode] || `SSO error: ${errorCode}`;
      queueMicrotask(() => {
        if (errorDetail && errorCode === 'sso_token_failed') {
          setError(`${baseMsg} ${errorDetail}`);
        } else {
          setError(baseMsg);
        }
      });

      // Clean the URL
      router.replace('/login');
    }
  }, [searchParams, setToken, setUser, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loginPayload: Record<string, any> = { email: form.email, password: form.password, rememberMe };
      if (emergencyKey) {
        loginPayload.emergency_key = emergencyKey;
      }
      const res = await api.post<{ data: { user: User; token: string; refreshToken?: string; passwordResetRequired?: boolean } }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        mode === 'login' ? loginPayload : form
      );
      setToken(res.data.token);
      setUser(res.data.user);

      // Store refresh token if provided
      if (res.data.refreshToken) {
        localStorage.setItem('resolv_refresh_token', res.data.refreshToken);
      }

      if (rememberMe) {
        localStorage.setItem('resolv_remember_me', 'true');
        localStorage.setItem('resolv_remembered_email', form.email);
      } else {
        localStorage.removeItem('resolv_remember_me');
        localStorage.removeItem('resolv_remembered_email');
      }
      if (res.data.passwordResetRequired) {
        router.push('/force-password-change');
      } else {
        router.push(res.data.user.role === 'user' ? '/dashboard/portal' : '/dashboard/tickets');
      }
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
    sessionStorage.setItem('resolv_sso_auto_cancelled', 'false');
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/oauth/google/authorize`;
  }

  function handleSsoSwitchAccount() {
    sessionStorage.setItem('resolv_sso_auto_cancelled', 'false');
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/oauth/google/authorize?prompt=select_account`;
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotResetLink(null);
    try {
      const res = await api.post<{ message: string; resetLink?: string; emailSent?: boolean; fallbackMessage?: string }>('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(true);
      if (res.resetLink) {
        setForgotResetLink(res.resetLink);
        setForgotEmailSent(res.emailSent ?? true);
        setForgotFallbackMessage(res.fallbackMessage || '');
      } else {
        setForgotEmailSent(true);
      }
    } catch {
      // Even if the endpoint fails, show success to prevent email enumeration
      setForgotSuccess(true);
      setForgotEmailSent(true);
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
          background-color: var(--accent-hover) !important;
        }
        .btn-sso:hover {
          background-color: var(--bg-elevated) !important;
        }
        .link-hover:hover {
          text-decoration: underline;
        }
        .input-field:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent) !important;
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        {/* LEFT PANEL - FORM (45%) */}
        <div style={{
          width: '45%',
          backgroundColor: 'var(--bg)',
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
              <Image src="/logo.png" alt="Resolv Logo" width={280} height={153} priority style={{ width: '280px', height: '153px', objectFit: 'contain' }} />
            </div>

            {/* Auto-redirect UI for SSO-only mode */}
            {autoRedirecting && (
              <div style={{ width: '100%', textAlign: 'center' }} className="fade-in">
                <div style={{ marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Building2 size={28} color="#60a5fa" />
                  </div>
                  <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>
                    Signing you in...
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 16px 0' }}>
                    Authenticating with SSO in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}
                  </p>
                  <div style={{ width: 200, height: 3, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((3 - redirectCountdown) / 3) * 100}%`, borderRadius: 2, background: 'linear-gradient(90deg, var(--accent), var(--accent-mid))', transition: 'width 1s linear' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={handleSsoSwitchAccount}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-mid)', fontSize: 13, cursor: 'pointer', padding: '8px 16px', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-mid)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--accent-mid)'}
                    >
                      Sign in with a different account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ssoConfigLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-mid)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Checking configuration...</p>
              </div>
            ) : !autoRedirecting && (
            <div style={{ width: '100%' }}>
              <h1 style={{ color: 'var(--text)', fontSize: '28px', fontWeight: 700, margin: '0 0 24px 0', textAlign: 'center' }}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </h1>

            {error && (
              <div className="shake" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '8px',
                color: 'var(--danger)',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Conditionally show password form (hidden in SSO-only mode without emergency key) */}
            {!(loginMode === 'sso_only' && !emergencyKey && mode === 'login') && (
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
                      style={{ background: 'none', border: 'none', color: 'var(--accent-mid)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
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
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
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
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }} 
                  />
                  <label htmlFor="remember" style={{ color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}>
                    Remember me
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text)',
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
            )}

                {/* SSO button — show when enabled and not in password_only mode */}
                {ssoEnabled && !ssoConfigLoading && mode === 'login' && loginMode !== 'password_only' && (
              <div style={{ marginTop: '24px' }}>
                {/* Show "or" divider only when both password form and SSO are visible */}
                {loginMode !== 'sso_only' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--border)' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or</span>
                    <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--border)' }} />
                  </div>
                )}
                
                {loginMode === 'sso_only' && (
                  <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 4px 0' }}>
                      Sign in with your organization account
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                      Use your company credentials to access the system.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSsoClick}
                  className="btn-sso"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
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
              </div>
            )}

            {!(loginMode === 'sso_only' && !emergencyKey && mode === 'login') && (
            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="link-hover"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}
              >
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
              </button>
            </div>
            )}
            </div>
            )}

          </div>

          <div style={{ position: 'absolute', bottom: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
            © 2025 Resolv
          </div>
        </div>

        {/* RIGHT PANEL - BRAND VISUAL (55%) */}
        <div style={{
          width: '55%',
          background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, black) 60%, var(--accent-mid) 100%)',
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
            <h2 style={{ color: 'var(--text)', fontSize: '36px', fontWeight: 700, margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
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
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px',
            position: 'relative'
          }}>
            <button 
              onClick={() => { setShowForgotModal(false); setForgotSuccess(false); setForgotEmail(''); setForgotResetLink(null); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '20px', fontWeight: 600 }}>Reset Password</h3>
            
            {forgotSuccess ? (
              <>
                {forgotResetLink && !forgotEmailSent ? (
                  <>
                    {forgotFallbackMessage && (
                      <p style={{ color: 'var(--warning)', fontSize: '14px', lineHeight: '1.5', margin: '16px 0 8px 0', backgroundColor: 'rgba(234,179,8,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.2)' }}>
                        {forgotFallbackMessage}
                      </p>
                    )}
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px 0' }}>Your reset link:</p>
                      <a href={forgotResetLink} style={{ display: 'block', wordBreak: 'break-all', color: 'var(--accent)', fontSize: '13px', lineHeight: '1.5', padding: '10px 14px', backgroundColor: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {forgotResetLink}
                      </a>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '8px 0 0 0' }}>
                        This link expires in 1 hour. Save it — you won't see it again after closing this window.
                      </p>
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--success)', fontSize: '15px', lineHeight: '1.5', margin: '16px 0 0 0' }}>
                    If that email exists, you'll receive a reset link shortly.
                  </p>
                )}
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', marginTop: 0 }}>
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
                      backgroundColor: 'var(--accent)',
                      color: 'var(--text)',
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  height: '44px',
  width: '100%',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  padding: '0 12px',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text)',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};
