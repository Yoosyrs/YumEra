'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, timeAgo } from '@/lib/client';
import { Avatar, Empty, Modal, Spinner, Field } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Conversation {
  id: string;
  title: string | null;
  is_group: number;
  last_body: string | null;
  last_at: string | null;
  unread: number;
  other_username: string | null;
  other_name: string | null;
  other_avatar: string | null;
  member_count: number;
}

export default function MessagesPage() {
  const params = useSearchParams();
  const { push } = useToast();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(params.get('to') ?? '');
  const [groupTitle, setGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: Conversation[] }>('/api/messages');
      setItems(data.items ?? []);
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const usernames = target
      .split(',')
      .map((entry) => entry.replace(/^@/, '').trim())
      .filter(Boolean);
    if (usernames.length === 0) return;
    setCreating(true);
    try {
      const result = await api<{ id: string }>('/api/messages', {
        body: { usernames, title: groupTitle.trim() || undefined },
      });
      setOpen(false);
      setTarget('');
      setGroupTitle('');
      window.location.href = `/messages/${result.id}`;
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 2 }}>Messages</h1>
          <p className="tiny muted" style={{ margin: 0 }}>Private conversations and groups.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>+ New</button>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="No conversations" hint="Start a private chat with someone from their profile." action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Start a conversation</button>
        } />
      ) : (
        <div className="stack">
          {items.map((entry) => (
            <Link
              key={entry.id}
              href={`/messages/${entry.id}`}
              className="card card-pad card-hover row"
              style={{ gap: 12, color: 'inherit' }}
            >
              <Avatar
                src={entry.other_avatar}
                name={entry.other_name ?? entry.title ?? 'Group'}
                size={44}
              />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row-between">
                  <strong>
                    {entry.is_group ? entry.title || 'Group chat' : entry.other_name ?? entry.other_username ?? 'Conversation'}
                  </strong>
                  <span className="tiny muted-2">{entry.last_at ? timeAgo(entry.last_at) : ''}</span>
                </div>
                <p className="tiny muted" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.last_body || 'No messages yet'}
                </p>
              </div>
              {entry.unread > 0 && <span className="badge badge-warn">{entry.unread}</span>}
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} title="New conversation" onClose={() => setOpen(false)}>
        <div className="stack">
          <Field label="Usernames" hint="Separate several usernames with commas to create a group.">
            <input
              className="input"
              placeholder="@moonlight, @starlight"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </Field>
          <Field label="Group name (optional)">
            <input className="input" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
          </Field>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void create()} disabled={creating || !target.trim()}>
              {creating ? 'Opening…' : 'Open chat'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
