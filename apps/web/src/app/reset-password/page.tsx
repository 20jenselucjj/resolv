'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = searchParams?.get('token');
    if (t) {
      setToken(t);
    } else {
      setError('No reset token found. Please request a new password reset link.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reset password. The link may have expired.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
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
        .input-field:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent) !important;
        }
        .link-hover:hover {
          text-decoration: underline;
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        {/* LEFT PANEL - FORM */}
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

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px' }}>
              <Image src="/logo.png" alt="Resolv Logo" width={200} height={109} priority style={{ width: '200px', height: '109px', objectFit: 'contain' }} />
            </div>

            {error && (
              <div className="shake" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '8px',
                color: 'var(--danger)',
                fontSize: '14px',
                marginBottom: '20px',
                width: '100%'
              }}>
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle size={28} color="#22c55e" />
                </div>
                <h2 style={{ color: 'var(--text)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
                  Password reset successful
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px 0' }}>
                  Your password has been changed. You can now sign in with your new password.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="link-hover"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--text)',
                    border: 'none',
                    borderRadius: '6px',
                    height: '44px',
                    padding: '0 24px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  Sign In
                </button>
              </div>
            ) : token ? (
              <>
                <h1 style={{ color: 'var(--text)', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', textAlign: 'center' }}>
                  Reset your password
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px 0', textAlign: 'center' }}>
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          height: '44px', width: '100%', borderRadius: '6px',
                          border: '1px solid #334155', padding: '0 40px 0 12px',
                          backgroundColor: 'var(--bg-secondary)', color: 'var(--text)',
                          fontSize: '15px', outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        className="input-field"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Confirm Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{
                          height: '44px', width: '100%', borderRadius: '6px',
                          border: '1px solid #334155', padding: '0 40px 0 12px',
                          backgroundColor: 'var(--bg-secondary)', color: 'var(--text)',
                          fontSize: '15px', outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        className="input-field"
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
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
                    Reset Password
                  </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <button
                    onClick={() => router.push('/login')}
                    className="link-hover"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Back to Sign In
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div style={{ position: 'absolute', bottom: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
            © 2025 Resolv
          </div>
        </div>

        {/* RIGHT PANEL - BRAND VISUAL */}
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
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            zIndex: 1
          }} />
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

          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '40px' }} className="fade-in">
            <h2 style={{ color: 'var(--text)', fontSize: '36px', fontWeight: 700, margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
              IT Service Management
            </h2>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
