'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, User } from '@/lib/store';
import { api } from '@/lib/api';
import { SelectSearch } from '@/components/SelectSearch';
import { 
  AlignLeft,
  User as UserIcon, Shield, Lock, Smartphone, Building, 
  CheckCircle, AlertCircle, Loader2, Camera, Bell, 
  Globe, Laptop, Key
} from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser, logout } = useStore();
  const router = useRouter();
  
  const [notificationPopups, setNotificationPopups] = useState(true);

  // Sync notification popups state when user loads
  useEffect(() => {
    if (user?.notification_popups !== undefined) {
      setNotificationPopups(user.notification_popups);
    }
  }, [user?.notification_popups]);
  
  // Profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileDept, setProfileDept] = useState(user?.department || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityStatus, setSecurityStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  
  const [notifications, setNotifications] = useState({
    assigned: true,
    updated: false,
    sla: true,
    comment: true,
    resolved: true
  });
  
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('resolv_language') || 'en';
    return 'en';
  });
  const [timezone, setTimezone] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('resolv_timezone') || 'UTC';
    return 'UTC';
  });
  const [defaultView, setDefaultView] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('resolv_default_view') || 'all';
    return 'all';
  });
  const [defaultSort, setDefaultSort] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('resolv_default_sort') || 'newest';
    return 'newest';
  });
   
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNotifs = localStorage.getItem('resolv_notification_prefs');
      if (savedNotifs) {
        try { setNotifications(JSON.parse(savedNotifs)); } catch {}
      }
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    setProfileStatus(null);
    try {
      const updatedUser = await api.patch<{ data: User }>(`/users/${user.id}`, {
        name: profileName,
        department: profileDept,
        phone: profilePhone,
        ...(user.role === 'admin' ? { email: profileEmail } : {})
      });
      setUser(updatedUser.data);
      setProfileStatus({ type: 'success', msg: 'Profile updated successfully' });
    } catch (err: unknown) {
      setProfileStatus({ type: 'error', msg: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 8) {
      setSecurityStatus({ type: 'error', msg: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityStatus({ type: 'error', msg: 'Passwords do not match' });
      return;
    }
    setIsChangingPassword(true);
    setSecurityStatus(null);
    try {
      await api.post(`/users/${user.id}/change-password`, { currentPassword, newPassword });
      setSecurityStatus({ type: 'success', msg: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setSecurityStatus({ type: 'error', msg: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      localStorage.setItem('resolv_notification_prefs', JSON.stringify(notifications));
      // Show brief success feedback
      setProfileStatus({ type: 'success', msg: 'Notification preferences saved' });
      setTimeout(() => setProfileStatus(null), 3000);
    } catch {
      // silently fail
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 32px' }}>
        
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Settings</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Manage your profile, security, and preferences</p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', 
          gap: 24,
          alignItems: 'start'
        }}>
          
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Profile Section */}
            <Section title="Profile" icon={<UserIcon size={16} />}>
              <form key={user?.id} onSubmit={handleSaveProfile} style={{ padding: 20 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, fontWeight: 700, color: '#fff',
                      border: '4px solid var(--accent-border)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      style={{
                        position: 'absolute', bottom: -4, right: -4,
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text)', cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }} title="Upload photo">
                      <Camera size={14} />
                    </button>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        // Preview locally — upload support coming soon
                        const url = URL.createObjectURL(file);
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{user?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Shield size={12} /> {user?.role.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} style={{ ...inputStyle, opacity: user?.role === 'admin' ? 1 : 0.6 }} disabled={user?.role !== 'admin'} required />
                    {user?.role !== 'admin' && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Only administrators can change email addresses.</p>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}><Building size={12} style={{ marginRight: 4 }} /> Department</label>
                      <input type="text" value={profileDept} onChange={e => setProfileDept(e.target.value)} style={inputStyle} placeholder="e.g. IT, HR" />
                    </div>
                    <div>
                      <label style={labelStyle}><Smartphone size={12} style={{ marginRight: 4 }} /> Phone</label>
                      <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} style={inputStyle} placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>
                </div>

                {profileStatus && (
                  <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: profileStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: profileStatus.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {profileStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {profileStatus.msg}
                  </div>
                )}

                <button type="submit" disabled={isSavingProfile} style={{ ...btnStyle, marginTop: 24, width: '100%' }}>
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              </form>
            </Section>

            {/* Notifications */}
            <Section title="Notifications" icon={<Bell size={16} />}>
              <div style={{ padding: '4px 0' }}>
                <SettingRow label="Pop-up Notifications" description="Show a pop-up when a new notification arrives">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={notificationPopups}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setNotificationPopups(enabled);
                        if (!user) return;
                        setUser({ ...user, notification_popups: enabled });
                        api.patch(`/users/${user.id}`, { notification_popups: enabled }).catch(() => {});
                      }}
                      style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                    />
                    Enabled
                  </label>
                </SettingRow>
                <SettingRow label="Email Notifications" description="Select when you want to receive emails">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
                    {[
                      { key: 'assigned', label: 'Ticket assigned to me' },
                      { key: 'updated', label: 'Ticket updated' },
                      { key: 'sla', label: 'SLA breach warning' },
                      { key: 'comment', label: 'New comment' },
                      { key: 'resolved', label: 'Ticket resolved' },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={notifications[key as keyof typeof notifications]} 
                          onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                        {label}
                      </label>
                    ))}
                    <button type="button" onClick={handleSaveNotifications} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Save Preferences
                    </button>
                  </div>
                </SettingRow>
              </div>
            </Section>

            {/* Security Section */}
            <Section title="Security & Sessions" icon={<Lock size={16} />}>
              <form onSubmit={handleChangePassword} style={{ padding: 20, borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} /> Change Password
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required minLength={8} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
                  </div>
                </div>

                {securityStatus && (
                  <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: securityStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: securityStatus.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                    {securityStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {securityStatus.msg}
                  </div>
                )}

                <button type="submit" disabled={isChangingPassword} style={{ ...btnStyle, marginTop: 16, width: '100%', background: 'var(--text)', color: 'var(--bg)' }}>
                  {isChangingPassword ? <Loader2 size={16} className="animate-spin" /> : 'Update Password'}
                </button>
              </form>
              
              {/* Active Sessions */}
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Laptop size={14} /> Active Sessions
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Laptop size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Current Session</div>
                      <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} /> Active now
                      </div>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
                  This application uses stateless JWT tokens — signing out on all devices requires logging out on each device individually.
                </p>
                <button 
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  style={{ ...btnStyle, marginTop: 16, width: '100%', background: 'var(--danger)', color: '#fff', border: 'none' }}
                >
                  Sign Out
                </button>
              </div>
            </Section>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Preferences Section */}
            <Section title="Appearance & Localization" icon={<Globe size={16} />}>
              <div style={{ padding: '4px 0' }}>
                <SettingRow label="Language" description="Select your preferred language">
                  <div style={{ width: 180 }}>
                    <SelectSearch
                      options={[
                        { value: 'en', label: 'English (US)' },
                        { value: 'es', label: 'Español' },
                        { value: 'fr', label: 'Français' },
                        { value: 'de', label: 'Deutsch' },
                        { value: 'pt', label: 'Português' },
                      ]}
                      value={language}
                      onChange={val => {
                        const lang = val || 'en';
                        setLanguage(lang);
                        localStorage.setItem('resolv_language', lang);
                      }}
                    />
                  </div>
                </SettingRow>
                
                <SettingRow label="Timezone" description="Set your local timezone">
                  <div style={{ width: 220 }}>
                    <SelectSearch
                      options={[

                        { value: 'America/New_York', label: 'Eastern Time (ET)' },
                        { value: 'America/Chicago', label: 'Central Time (CT)' },
                        { value: 'America/Denver', label: 'Mountain Time (MT)' },
                        { value: 'America/Phoenix', label: 'Arizona (MST no DST)' },
                        { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                        { value: 'America/Anchorage', label: 'Alaska (AKT)' },
                        { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
                        { value: 'America/Puerto_Rico', label: 'Atlantic Time (AST)' },

                        { value: 'Canada/Atlantic', label: 'Atlantic Time (Canada)' },
                        { value: 'America/St_Johns', label: 'Newfoundland (NT)' },

                        { value: 'UTC', label: 'UTC' },
                        { value: 'Europe/London', label: 'London (GMT/BST)' },
                        { value: 'Europe/Paris', label: 'Central Europe (CET)' },
                        { value: 'Europe/Helsinki', label: 'Eastern Europe (EET)' },
                        { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
                        { value: 'Asia/Dubai', label: 'Dubai (GST)' },
                        { value: 'Asia/Kolkata', label: 'India (IST)' },
                        { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
                        { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
                        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                        { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
                        { value: 'Pacific/Auckland', label: 'New Zealand (NZDT)' },
                      ]}
                      value={timezone}
                      onChange={val => {
                        const tz = val || 'UTC';
                        setTimezone(tz);
                        localStorage.setItem('resolv_timezone', tz);
                      }}
                    />
                  </div>
                </SettingRow>

                <SettingRow label="Theme" description="Dark mode only" last>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Dark
                  </div>
                </SettingRow>
              </div>
            </Section>

            {/* Default Views */}
            <Section title="Default Views" icon={<AlignLeft size={16} />}>
              <div style={{ padding: '4px 0' }}>
                <SettingRow label="Default Ticket View" description="What to show when you open the tickets page">
                  <div style={{ width: 180 }}>
                    <SelectSearch
                      options={[
                        { value: 'all', label: 'All Tickets' },
                        { value: 'my', label: 'My Tickets' },
                        { value: 'unassigned', label: 'Unassigned' }
                      ]}
                      value={defaultView}
                      onChange={val => {
                        const actualVal = val || 'all';
                        setDefaultView(actualVal);
                        localStorage.setItem('resolv_default_view', actualVal);
                      }}
                    />
                  </div>
                </SettingRow>
                
                <SettingRow label="Default Sort Order" description="How to sort your ticket lists" last>
                  <div style={{ width: 180 }}>
                    <SelectSearch
                      options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'priority', label: 'Highest Priority' },
                        { value: 'due_date', label: 'Due Date' }
                      ]}
                      value={defaultSort}
                      onChange={val => {
                        const actualVal = val || 'newest';
                        setDefaultSort(actualVal);
                        localStorage.setItem('resolv_default_sort', actualVal);
                      }}
                    />
                  </div>
                </SettingRow>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          {title}
        </h2>
      </div>
      <div className="card" style={{ overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children, last }: { label: string; description: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
    }}>
      <div style={{ paddingRight: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--text)', outline: 'none', transition: 'border-color var(--transition)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, paddingRight: 32, cursor: 'pointer', appearance: 'auto'
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
};
