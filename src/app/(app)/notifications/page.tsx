'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, timeAgo } from '@/lib/client';
import { Avatar, Empty, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface NotificationItem {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  target_type: string | null;
  target_id: string | null;
  is_read: number;
  created_at: string;
  actor_username: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'social', label: 'Social' },
  { key: 'interactions', label: 'Interactions' },
  { key: 'community', label: 'Community' },
  { key: 'myyume', label: 'My Yume' },
  { key: 'character', label: 'Character World' },
  { key: 'system', label: 'System' },
];

function targetHref(item: NotificationItem): string | null {
  if (!item.target_id) return null;
  switch (item.target_type) {
    case 'post':
      return `/post/${item.target_id}`;
    case 'profile':
    case 'user':
      return item.actor_username ? `/u/${item.actor_username}` : null;
    case 'conversation':
      return `/messages/${item.target_id}`;
    case 'community':
      return `/communities/${item.target_id}`;
    case 'story':
      return `/stories/${item.target_id}`;
    case 'character':
      return `/characters/${item.target_id}`;
    case 'gallery':
      return `/gallery/${item.target_id}`;
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const { push } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: NotificationItem[]; unread: number }>(
        `/api/notifications?category=${filter}&unread=${onlyUnread ? 1 : 0}&limit=60`,
      );
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, onlyUnread, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, is_read: 1 } : item)));
    try {
      await api('/api/notifications', { method: 'PATCH', body: { id, isRead: true } });
      setUnread((value) => Math.max(0, value - 1));
      window.dispatchEvent(new Event('yumera:notifications'));
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await api('/api/notifications', { body: { all: true } });
      setItems((current) => current.map((item) => ({ ...item, is_read: 1 })));
      setUnread(0);
      push('All notifications marked as read');
      window.dispatchEvent(new Event('yumera:notifications'));
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 2 }}>Notifications</h1>
          <p className="tiny muted" style={{ margin: 0 }}>Your universe has something to tell you.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/settings#notifications" className="btn btn-sm btn-ghost">Settings</Link>
          <button className="btn btn-sm" onClick={() => void markAll()} disabled={busy || unread === 0}>
            Mark all as read
          </button>
        </div>
      </div>

      <div className="row-between">
        <div className="tabs" style={{ overflowX: 'auto' }}>
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              className={`chip ${filter === entry.key ? 'chip-static active' : ''}`}
              onClick={() => setFilter(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="row tiny" style={{ gap: 6 }}>
          <input type="checkbox" checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
          Unread only
        </label>
      </div>

      <p className="tiny muted" style={{ margin: 0 }}>{unread} unread</p>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="Nothing here yet" hint="Follow someone, comment on a post or join a community to start your history." />
      ) : (
        <div className="stack">
          {items.map((item) => {
            const href = targetHref(item);
            const body = (
              <>
                <Avatar src={item.actor_avatar} name={item.actor_name ?? 'YumEra'} size={36} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <strong className="tiny">{item.title}</strong>
                    {!item.is_read && <span className="dot" />}
                  </span>
                  <span className="tiny muted" style={{ display: 'block' }}>{item.message}</span>
                  <span className="tiny muted-2">{timeAgo(item.created_at)}</span>
                </span>
              </>
            );
            return (
              <div key={item.id} className={`notif-row ${item.is_read ? '' : 'notif-unread'}`}>
                {href ? (
                  <Link href={href} onClick={() => void markRead(item.id)} className="row" style={{ gap: 10, color: 'inherit', flex: 1, minWidth: 0 }}>
                    {body}
                  </Link>
                ) : (
                  <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>{body}</div>
                )}
                <span className="row" style={{ gap: 4 }}>
                  {!item.is_read && (
                    <button className="btn btn-sm btn-ghost" onClick={() => void markRead(item.id)} title="Mark as read">✓</button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => void remove(item.id)} title="Delete">✕</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
