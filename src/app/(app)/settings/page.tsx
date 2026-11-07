'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert, Avatar, Field, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';

interface Me {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  pronouns: string;
  locale: string;
  isPrivate: boolean;
  soulColor: string;
}

interface Preferences {
  preferences: Record<string, boolean>;
  settings: {
    muted: boolean;
    sound: string;
    quietStart: string;
    quietEnd: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    email: string;
  };
  devices: number;
  unread: number;
}

interface Tone {
  id: string;
  name: string;
  baseFreq: number;
  waveform: string;
  decay: number;
  sparkle: number;
}

const PREF_LABELS: Record<string, string> = {
  followers: 'New followers',
  friends: 'Friend requests',
  messages: 'Messages',
  comments: 'Comments',
  reactions: 'Reactions',
  mentions: 'Mentions',
  stories: 'Story activity',
  events: 'Community events',
  character: 'Character World replies',
  announcements: 'Official announcements',
};

const WAVES = ['bell', 'glass', 'sine', 'triangle'];

export default function SettingsPage() {
  const { push } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [tones, setTones] = useState<Tone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [pushState, setPushState] = useState({ publicKey: '', subscribed: false, devices: 0 });
  const [support, setSupport] = useState({ supported: true, reason: '' });
  const [busy, setBusy] = useState(false);
  const [newTone, setNewTone] = useState({ name: '', baseFreq: 880, waveform: 'bell', decay: 1.6, sparkle: 3 });
  const audioCtx = useRef<AudioContext | null>(null);

  const load = useCallback(async () => {
    try {
      const [session, prefsData, toneData, pushData] = await Promise.all([
        api<{ user: Me }>('/api/auth/session'),
        api<Preferences>('/api/notifications/preferences'),
        api<{ tones: Tone[] }>('/api/tones'),
        api<{ publicKey: string; subscribed: boolean; devices: number }>('/api/push'),
      ]);
      setMe(session.user);
      setPrefs(prefsData);
      setTones(toneData.tones ?? []);
      setPushState({ publicKey: pushData.publicKey, subscribed: pushData.subscribed, devices: pushData.devices });
      setSupport(pushSupport());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (!me) return;
    setSavingProfile(true);
    try {
      const data = await api<{ user: Me }>('/api/auth/session', {
        method: 'PATCH',
        body: {
          displayName: me.displayName,
          bio: me.bio,
          pronouns: me.pronouns,
          avatarUrl: me.avatarUrl,
          coverUrl: me.coverUrl,
          soulColor: me.soulColor,
          locale: me.locale,
          isPrivate: me.isPrivate,
        },
      });
      setMe(data.user);
      push('Profile saved');
      window.dispatchEvent(new Event('yumera:session'));
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const upload = async (file: File, target: 'avatarUrl' | 'coverUrl') => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await api<{ url: string }>('/api/upload', { formData });
      setMe((current) => (current ? { ...current, [target]: result.url } : current));
      push('Image uploaded — remember to save');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const changePassword = async () => {
    try {
      await api('/api/auth/session', { method: 'PUT', body: passwords });
      setPasswords({ currentPassword: '', newPassword: '' });
      push('Password updated. Other sessions were signed out.');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const patchPrefs = async (patch: {
    preferences?: Record<string, boolean>;
    settings?: Record<string, unknown>;
  }) => {
    try {
      await api('/api/notifications/preferences', { method: 'PATCH', body: patch });
      const refreshed = await api<Preferences>('/api/notifications/preferences');
      setPrefs(refreshed);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const enablePush = async () => {
    if (!pushState.publicKey) {
      push('Push is not configured on the server (VAPID keys missing).', 'error');
      return;
    }
    setBusy(true);
    try {
      const subscription = await subscribeToPush(pushState.publicKey);
      await api('/api/push', { body: { subscription } });
      const data = await api<{ devices: number }>('/api/push');
      setPushState((current) => ({ ...current, subscribed: true, devices: data.devices ?? 1 }));
      push('Push notifications enabled for this device');
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      await api('/api/push', { method: 'DELETE' });
      setPushState((current) => ({ ...current, subscribed: false, devices: 0 }));
      push('Push notifications disabled for this device');
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const testPush = async () => {
    try {
      await api('/api/push', { body: { test: true } });
      push('Test notification sent to your devices');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const playTone = (baseFreq: number, waveform: string, decay: number, sparkle: number) => {
    try {
      audioCtx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtx.current;
      void ctx.resume();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      master.connect(ctx.destination);

      const partials = waveform === 'glass' ? [1, 2.01, 3.02, 4.7] : waveform === 'bell' ? [1, 2.76, 5.4] : waveform === 'triangle' ? [1, 3, 5] : [1];
      partials.forEach((ratio, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveform === 'triangle' ? 'triangle' : waveform === 'sine' ? 'sine' : 'sine';
        osc.frequency.setValueAtTime(baseFreq * ratio, now);
        gain.gain.setValueAtTime(0.5 / (index + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay * (1 - index * 0.12));
        osc.connect(gain).connect(master);
        osc.start(now);
        osc.stop(now + decay + 0.1);
      });

      for (let i = 0; i < sparkle; i += 1) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * (2 + i * 0.75), now + 0.06 * i);
        gain.gain.setValueAtTime(0.0001, now + 0.06 * i);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.06 * i + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 * i + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + 0.06 * i);
        osc.stop(now + 0.06 * i + 0.4);
      }
    } catch {
      push('Your browser blocked audio playback.', 'error');
    }
  };

  const createTone = async () => {
    if (!newTone.name.trim()) return;
    try {
      const data = await api<{ tone: Tone }>('/api/tones', { body: newTone });
      setTones((current) => [...current, data.tone]);
      setNewTone({ name: '', baseFreq: 880, waveform: 'bell', decay: 1.6, sparkle: 3 });
      push('Tone created');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const deleteTone = async (id: string) => {
    try {
      await api(`/api/tones?id=${id}`, { method: 'DELETE' });
      setTones((current) => current.filter((tone) => tone.id !== id));
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!me || !prefs) return null;

  return (
    <div className="page-narrow stack">
      <div>
        <h1 style={{ marginBottom: 2 }}>Settings</h1>
        <p className="tiny muted" style={{ margin: 0 }}>Your account, your universe, your rules.</p>
      </div>

      <section className="card card-pad stack">
        <strong>Profile</strong>
        <div className="row" style={{ gap: 12 }}>
          <Avatar src={me.avatarUrl} name={me.displayName} size={56} />
          <label className="btn btn-sm">
            Change photo
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file, 'avatarUrl');
              }}
            />
          </label>
          <label className="btn btn-sm">
            Change cover
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file, 'coverUrl');
              }}
            />
          </label>
        </div>
        <Field label="Display name">
          <input className="input" value={me.displayName} maxLength={60} onChange={(event) => setMe({ ...me, displayName: event.target.value })} />
        </Field>
        <Field label="Username" hint="Usernames cannot be changed.">
          <input className="input" value={me.username} disabled />
        </Field>
        <Field label="Pronouns">
          <input className="input" value={me.pronouns} maxLength={40} onChange={(event) => setMe({ ...me, pronouns: event.target.value })} />
        </Field>
        <Field label="Bio">
          <textarea className="textarea" rows={4} maxLength={600} value={me.bio} onChange={(event) => setMe({ ...me, bio: event.target.value })} />
        </Field>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="Soul colour">
            <input className="input" type="color" value={me.soulColor || '#b892ff'} onChange={(event) => setMe({ ...me, soulColor: event.target.value })} />
          </Field>
          <Field label="Language">
            <select className="select" value={me.locale} onChange={(event) => setMe({ ...me, locale: event.target.value })}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ja">日本語</option>
            </select>
          </Field>
        </div>
        <label className="row tiny" style={{ gap: 8 }}>
          <input type="checkbox" checked={me.isPrivate} onChange={(event) => setMe({ ...me, isPrivate: event.target.checked })} />
          Private account — only approved followers see my posts
        </label>
        <button className="btn btn-primary" onClick={() => void saveProfile()} disabled={savingProfile}>
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      <section className="card card-pad stack" id="notifications">
        <div className="row-between">
          <strong>Notification preferences</strong>
          <Link href="/notifications" className="btn btn-sm btn-ghost">Open centre</Link>
        </div>
        {Object.entries(PREF_LABELS).map(([key, label]) => (
          <label key={key} className="row-between tiny">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={prefs.preferences[key] !== false}
              onChange={(event) => void patchPrefs({ preferences: { [key]: event.target.checked } })}
            />
          </label>
        ))}
        <div className="divider" />
        <label className="row-between tiny">
          <span>Mute all notifications</span>
          <input
            type="checkbox"
            checked={prefs.settings.muted}
            onChange={(event) => void patchPrefs({ settings: { muted: event.target.checked } })}
          />
        </label>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="Quiet hours start">
            <input className="input" type="time" value={prefs.settings.quietStart} onChange={(event) => void patchPrefs({ settings: { quietStart: event.target.value } })} />
          </Field>
          <Field label="Quiet hours end">
            <input className="input" type="time" value={prefs.settings.quietEnd} onChange={(event) => void patchPrefs({ settings: { quietEnd: event.target.value } })} />
          </Field>
        </div>
        <label className="row-between tiny">
          <span>Email notifications</span>
          <input
            type="checkbox"
            checked={prefs.settings.emailEnabled}
            onChange={(event) => void patchPrefs({ settings: { emailEnabled: event.target.checked } })}
          />
        </label>
        <p className="tiny muted" style={{ margin: 0 }}>
          Email delivery requires a configured mail provider on the server. Internal notifications always work.
        </p>
      </section>

      <section className="card card-pad stack">
        <strong>Outside notifications (Web Push)</strong>
        <p className="tiny muted" style={{ margin: 0 }}>
          Push notifications arrive even when YumEra is closed, as long as your browser, operating system and permissions allow it.
        </p>
        {!support.supported && <Alert>{support.reason}</Alert>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => void enablePush()} disabled={busy || !support.supported}>
            {pushState.subscribed ? 'Re-subscribe this device' : 'Enable push on this device'}
          </button>
          {pushState.subscribed && (
            <>
              <button className="btn btn-sm" onClick={() => void testPush()} disabled={busy}>Send test</button>
              <button className="btn btn-sm btn-ghost" onClick={() => void disablePush()} disabled={busy}>Disable</button>
            </>
          )}
        </div>
        <span className="tiny muted">{pushState.devices} device(s) subscribed</span>
        <p className="tiny muted" style={{ margin: 0 }}>
          Private message content is never shown on the lock screen; only a generic notice.
        </p>
      </section>

      <section className="card card-pad stack">
        <strong>Notification sound</strong>
        <div className="stack" style={{ gap: 6 }}>
          {[
            { value: 'signature', label: 'YumEra Signature Tone' },
            { value: 'device', label: 'Default device sound' },
            { value: 'silent', label: 'Silent' },
          ].map((option) => (
            <label key={option.value} className="row-between tiny">
              <span>{option.label}</span>
              <input
                type="radio"
                name="sound"
                checked={prefs.settings.sound === option.value}
                onChange={() => void patchPrefs({ settings: { sound: option.value } })}
              />
            </label>
          ))}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (prefs.settings.sound === 'signature') playTone(1046, 'glass', 1.8, 3);
            else if (prefs.settings.sound === 'silent') push('Silent selected');
            else push('The default device sound is chosen by your operating system.');
          }}
        >
          Play preview
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          Browsers and operating systems decide the sound of push notifications. YumEra plays this tone for in-app
          notifications; a custom file cannot always replace the system push sound.
        </p>
      </section>

      <section className="card card-pad stack">
        <strong>Custom tones</strong>
        <div className="stack" style={{ gap: 6 }}>
          {tones.map((tone) => (
            <div key={tone.id} className="row-between">
              <span className="tiny">{tone.name} · {tone.waveform} · {tone.baseFreq}Hz</span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => playTone(tone.baseFreq, tone.waveform, tone.decay, tone.sparkle)}>▶</button>
                <button className="btn btn-sm btn-ghost" onClick={() => void deleteTone(tone.id)}>✕</button>
              </span>
            </div>
          ))}
          {tones.length === 0 && <p className="tiny muted" style={{ margin: 0 }}>No custom tones yet.</p>}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Tone name" value={newTone.name} onChange={(event) => setNewTone({ ...newTone, name: event.target.value })} style={{ flex: 1, minWidth: 140 }} />
          <select className="select" value={newTone.waveform} onChange={(event) => setNewTone({ ...newTone, waveform: event.target.value })}>
            {WAVES.map((wave) => <option key={wave} value={wave}>{wave}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => playTone(newTone.baseFreq, newTone.waveform, newTone.decay, newTone.sparkle)}>Preview</button>
          <button className="btn btn-sm btn-primary" onClick={() => void createTone()} disabled={!newTone.name.trim()}>Create</button>
        </div>
        <label className="tiny muted">
          Pitch {newTone.baseFreq}Hz
          <input type="range" min={220} max={1800} step={10} value={newTone.baseFreq} onChange={(event) => setNewTone({ ...newTone, baseFreq: Number(event.target.value) })} style={{ width: '100%' }} />
        </label>
        <label className="tiny muted">
          Sparkles {newTone.sparkle}
          <input type="range" min={0} max={6} value={newTone.sparkle} onChange={(event) => setNewTone({ ...newTone, sparkle: Number(event.target.value) })} style={{ width: '100%' }} />
        </label>
      </section>

      <section className="card card-pad stack">
        <strong>Install YumEra on your iPhone</strong>
        <ol className="tiny" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Open YumEra in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose “Add to Home Screen”.</li>
          <li>Confirm the installation.</li>
          <li>Open YumEra from its new icon.</li>
          <li>Come back to Notification Settings.</li>
          <li>Enable Push Notifications.</li>
          <li>Accept the system permission when it appears.</li>
        </ol>
        <p className="tiny muted" style={{ margin: 0 }}>
          Web Push on iOS and iPadOS requires version 16.4 or later and an app added to the Home Screen.
        </p>
      </section>

      <section className="card card-pad stack">
        <strong>Account security</strong>
        <Field label="Current password">
          <input className="input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input className="input" type="password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
        </Field>
        <button
          className="btn"
          onClick={() => void changePassword()}
          disabled={!passwords.currentPassword || passwords.newPassword.length < 8}
        >
          Update password
        </button>
      </section>
    </div>
  );
}
