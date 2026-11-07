'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { Alert, Field } from '@/components/ui';

type Mode = 'login' | 'register' | 'reset' | 'reset-confirm';

const FEATURES: Array<{ icon: string; title: string; text: string }> = [
  { icon: '❖', title: 'Yume Feed', text: 'Share posts, art and moments with a community that understands fictional love.' },
  { icon: '♡', title: 'Yumesona Studio', text: 'Build and keep every version of yourself — bios, lore, traits and galleries.' },
  { icon: '★', title: 'F/O Registry', text: 'Register your fictional others with Anti-Double protection and private notes.' },
  { icon: '🖼', title: 'Portrait Studio', text: 'Compose portraits layer by layer. No generative AI, only real graphic tools.' },
  { icon: '♪', title: 'Original Music', text: 'Twenty-four original songs written for YumEra, with AI-curated playlists.' },
  { icon: '🔔', title: 'Outside Notifications', text: 'Web Push that reaches you when YumEra is closed, on supported devices.' },
];

export function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    token: '',
    newPassword: '',
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await api('/api/auth/login', { body: { email: form.email, password: form.password } });
        router.push('/feed');
        router.refresh();
        return;
      }
      if (mode === 'register') {
        const result = await api<{ verificationToken?: string }>('/api/auth/register', {
          body: {
            email: form.email,
            username: form.username,
            displayName: form.displayName || form.username,
            password: form.password,
          },
        });
        router.push('/feed');
        router.refresh();
        void result;
        return;
      }
      if (mode === 'reset') {
        const result = await api<{ devToken?: string; message?: string }>('/api/auth/password-reset', {
          body: { email: form.email },
        });
        setNotice(
          result.devToken
            ? `Reset token (no email provider configured): ${result.devToken}`
            : result.message ?? 'If that email exists, a reset link has been sent.',
        );
        if (result.devToken) setForm((prev) => ({ ...prev, token: result.devToken ?? '' }));
        setMode('reset-confirm');
        return;
      }
      await api('/api/auth/password-reset', {
        method: 'PUT',
        body: { token: form.token, password: form.newPassword },
      });
      setNotice('Password updated. You can sign in now.');
      setMode('login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <div className="aura aura-1" />
      <div className="aura aura-2" />

      <header className="landing-head">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span className="brand-text">
            <span className="brand-title">YUMERA</span>
            <span className="brand-sub">ETERNAL UNIVERSE</span>
          </span>
        </div>
        <span className="tiny muted">A social universe for people who love fictional worlds.</span>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <h1 className="landing-title">
            Your universe
            <span className="landing-title-soft"> has a place here.</span>
          </h1>
          <p className="landing-lede">
            Yumeshipping, selfshipping, F/O, yumesonas and original worlds. Keep your lore, build your
            portraits and meet people who love the same fictional hearts you do.
          </p>

          <div className="grid grid-2 landing-features">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="tile">
                <div className="tile-art" aria-hidden>
                  {feature.icon}
                </div>
                <div className="tile-body">
                  <div className="tile-title">{feature.title}</div>
                  <p className="tile-desc">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-auth">
          <div className="card card-pad ornate">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                className={`chip chip-static ${mode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign in
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                className={`chip chip-static ${mode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Create account
              </button>
            </div>

            {error && <Alert>{error}</Alert>}
            {notice && <Alert kind="ok">{notice}</Alert>}

            <form onSubmit={submit} className="stack" style={{ marginTop: 14 }}>
              {mode !== 'reset-confirm' && (
                <Field label="Email">
                  <input
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@example.com"
                  />
                </Field>
              )}

              {mode === 'register' && (
                <>
                  <Field label="Username" hint="Letters, numbers and underscore. This is your @handle.">
                    <input
                      className="input"
                      required
                      pattern="[A-Za-z0-9_]{3,24}"
                      value={form.username}
                      onChange={set('username')}
                      placeholder="moonlight"
                    />
                  </Field>
                  <Field label="Display name">
                    <input
                      className="input"
                      value={form.displayName}
                      onChange={set('displayName')}
                      placeholder="Moonlight"
                    />
                  </Field>
                </>
              )}

              {(mode === 'login' || mode === 'register') && (
                <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
                  <input
                    className="input"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={form.password}
                    onChange={set('password')}
                  />
                </Field>
              )}

              {mode === 'reset-confirm' && (
                <>
                  <Field label="Reset token">
                    <input className="input" required value={form.token} onChange={set('token')} />
                  </Field>
                  <Field label="New password" hint="At least 8 characters.">
                    <input
                      className="input"
                      type="password"
                      required
                      minLength={8}
                      value={form.newPassword}
                      onChange={set('newPassword')}
                    />
                  </Field>
                </>
              )}

              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                {busy
                  ? 'Working…'
                  : mode === 'login'
                    ? 'Enter YumEra'
                    : mode === 'register'
                      ? 'Create my universe'
                      : mode === 'reset'
                        ? 'Send reset link'
                        : 'Set new password'}
              </button>
            </form>

            <div className="row-between" style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMode(mode === 'reset' ? 'login' : 'reset');
                  setError('');
                  setNotice('');
                }}
              >
                {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
              </button>
              <span className="tiny muted-2">Encrypted sessions</span>
            </div>
          </div>

          <p className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>
            YumEra never sells your data and never generates portraits with AI.
          </p>
        </section>
      </main>
    </div>
  );
}
