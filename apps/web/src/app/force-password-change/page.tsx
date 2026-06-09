'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const { user, token } = useStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/users/${user?.id}/change-password`, {
        newPassword: password,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push(user?.role === 'user' ? '/dashboard/portal' : '/dashboard/tickets');
      }, 1500);
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

  if (!token) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#0F172A' }}>
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
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .fade-in { animation: fadeIn 0.6s ease-out forwards; }
        .shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .btn-primary:hover:not(:disabled) { background-color: #1d4ed8 !important; }
        .input-field:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important; }
      `}</style>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
      }}>
        <div className="fade-in" style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '40px' }}>
            <Image src="/logo.png" alt="Resolv Logo" width={120} height={30} priority style={{ width: '120px', height: 'auto', objectFit: 'contain' }} />
          </div>

          {success ? (
            <div style={{ textAlign: 'center' }} className="fade-in">
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <CheckCircle size={28} color="#22c55e" />
              </div>
              <h2 style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>
                Password Updated
              </h2>
              <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', textAlign: 'center' }}>
                Set Your Password
              </h2>
              <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 32px 0', textAlign: 'center' }}>
                This is a temporary password. Please create a new one to continue.
              </p>

              {error && (
                <div className="shake" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '14px',
                  marginBottom: '20px',
                  width: '100%',
                }}>
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      style={{
                        height: '44px', width: '100%', borderRadius: '6px',
                        border: '1px solid #334155', padding: '0 40px 0 12px',
                        backgroundColor: '#1E293B', color: '#ffffff', fontSize: '15px',
                        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      className="input-field"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    style={{
                      height: '44px', width: '100%', borderRadius: '6px',
                      border: '1px solid #334155', padding: '0 12px',
                      backgroundColor: '#1E293B', color: '#ffffff', fontSize: '15px',
                      outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    className="input-field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    backgroundColor: '#2563EB', color: '#ffffff', border: 'none',
                    borderRadius: '6px', height: '44px', fontSize: '15px', fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                    marginTop: '8px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                  }}
                >
                  {loading && (
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  )}
                  Update Password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
