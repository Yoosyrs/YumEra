'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Modal } from './ui';
import { useI18n, useToast } from './providers';
import { LOCALES, LOCALE_LABELS, Locale } from '@/lib/i18n';
import { api } from '@/lib/client';

export interface ShellUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const GROUPS: Array<{ label: string; items: Array<{ href: string; icon: string; label: string }> }> = [
  {
    label: 'Social',
    items: [
      { href: '/feed', icon: '❖', label: 'Feed' },
      { href: '/explore', icon: '✧', label: 'Explore' },
      { href: '/messages', icon: '✉', label: 'Messages' },
      { href: '/notifications', icon: '🔔', label: 'Notifications' },
    ],
  },
  {
    label: 'My Yume',
    items: [
      { href: '/yumesonas', icon: '♡', label: 'Yumesona Studio' },
      { href: '/fos', icon: '★', label: 'F/O Registry' },
      { href: '/characters', icon: '✵', label: 'Character World' },
      { href: '/lore', icon: '❧', label: 'Yume Lore' },
      { href: '/memories', icon: '⌛', label: 'Yume Memories' },
      { href: '/diary', icon: '🔒', label: 'Private Diary' },
    ],
  },
  {
    label: 'Create',
    items: [
      { href: '/studio/portrait', icon: '🖼', label: 'Portrait Studio' },
      { href: '/studio/music', icon: '♪', label: 'Music Studio' },
      { href: '/studio/video', icon: '🎬', label: 'Video Studio' },
      { href: '/stories', icon: '📖', label: 'Stories' },
      { href: '/gallery', icon: '❁', label: 'Gallery' },
    ],
  },
  {
    label: 'Universe',
    items: [
      { href: '/communities', icon: '⚜', label: 'Communities' },
      { href: '/games', icon: '🎮', label: 'Yume Games' },
      { href: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
];

const MOBILE: Array<{ href: string; icon: string; label: string }> = [
  { href: '/feed', icon: '❖', label: 'Feed' },
  { href: '/explore', icon: '✧', label: 'Explore' },
  { href: '/studio/portrait', icon: '🖼', label: 'Create' },
  { href: '/messages', icon: '✉', label: 'Chat' },
  { href: '/notifications', icon: '🔔', label: 'Alerts' },
];

export function Shell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { push } = useToast();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api<{ unread: number }>('/api/notifications/count');
        if (alive) setUnread(data.unread);
      } catch {
        /* badge is non critical */
      }
    };
    void load();
    const timer = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/feed" className="brand">
          <span className="brand-mark">✦</span>
          <span className="brand-text">
            <span className="brand-title">YUMERA</span>
            <span className="brand-sub">ETERNAL UNIVERSE</span>
          </span>
        </Link>

        <nav style={{ overflowY: 'auto', flex: 1 }}>
          {GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`}>
                    <span className="nav-icon">{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.href === '/notifications' && unread > 0 && <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="divider" />
        <Link href={`/u/${user.username}`} className="row" style={{ gap: 10, color: 'inherit', textDecoration: 'none' }}>
          <Avatar src={user.avatar_url} name={user.display_name} size={40} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.display_name}</span>
            <span className="tiny muted">@{user.username}</span>
          </span>
        </Link>
        <button className="btn btn-ghost btn-sm btn-block" onClick={logout} style={{ marginTop: 10 }}>
          {t('nav.logout')}
        </button>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <Link href="/feed" className="brand mobile-only" style={{ gap: 6 }}>
            <span className="brand-mark">✦</span>
            <span className="brand-title" style={{ fontSize: 15 }}>YUMERA</span>
          </Link>
          <span className="topbar-title desktop-only">
            {GROUPS.flatMap((group) => group.items).find((item) => pathname.startsWith(item.href))?.label ?? 'YumEra'}
          </span>
          <span className="topbar-spacer" />
          <select
            className="select"
            style={{ width: 'auto' }}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            aria-label="Language"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
          <Link href="/notifications" className="btn btn-icon" aria-label="Notifications">
            🔔{unread > 0 && <span className="notif-dot" />}
          </Link>
          <button className="btn btn-icon mobile-only" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
        </header>

        <main className="page">{children}</main>
      </div>

      <nav className="bottom-nav">
        {MOBILE.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span style={{ fontSize: 10 }}>{item.label}</span>
              {item.href === '/notifications' && unread > 0 && <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          );
        })}
      </nav>

      <Modal open={menuOpen} title="YumEra" onClose={() => setMenuOpen(false)}>
        <div className="stack">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              <div className="grid grid-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{item.icon}</span> {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href={`/u/${user.username}`} className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>
            {t('nav.profile')}
          </Link>
          <button className="btn btn-ghost btn-block" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </Modal>
    </div>
  );
}
