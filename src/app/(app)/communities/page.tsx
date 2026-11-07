'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Empty, Field, Modal, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: string;
  member_count: number;
  my_status: string | null;
}

export default function CommunitiesPage() {
  const { push } = useToast();
  const [items, setItems] = useState<Community[]>([]);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', rules: '', visibility: 'public' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: Community[] }>(
        `/api/communities?scope=${scope}&q=${encodeURIComponent(q)}`,
      );
      setItems(data.items ?? []);
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [scope, q, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const data = await api<{ community: { id: string } }>('/api/communities', { body: form });
      setOpen(false);
      setForm({ name: '', description: '', rules: '', visibility: 'public' });
      push('Community created');
      window.location.href = `/communities/${data.community.id}`;
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
          <h1 style={{ marginBottom: 2 }}>Communities</h1>
          <p className="tiny muted" style={{ margin: 0 }}>Public and private circles for every universe.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>+ Create</button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Search communities…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <div className="tabs">
          <button className={`chip ${scope === 'all' ? 'chip-static active' : ''}`} onClick={() => setScope('all')}>
            All
          </button>
          <button className={`chip ${scope === 'mine' ? 'chip-static active' : ''}`} onClick={() => setScope('mine')}>
            Mine
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty title="No communities found" hint="Create one, or search a different name." action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Create community</button>
        } />
      ) : (
        <div className="stack">
          {items.map((community) => (
            <Link
              key={community.id}
              href={`/communities/${community.id}`}
              className="card card-pad card-hover stack"
              style={{ color: 'inherit', gap: 4 }}
            >
              <div className="row-between">
                <strong>{community.name}</strong>
                <span className="row" style={{ gap: 6 }}>
                  {community.visibility === 'private' && <span className="badge">Private</span>}
                  {community.my_status === 'active' && <span className="badge badge-ok">Member</span>}
                  {community.my_status === 'pending' && <span className="badge badge-warn">Pending</span>}
                </span>
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>{community.description || 'No description yet.'}</p>
              <span className="tiny muted-2">{community.member_count} members</span>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} title="Create a community" onClose={() => setOpen(false)}>
        <div className="stack">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="textarea" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Rules">
            <textarea className="textarea" rows={4} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} />
          </Field>
          <Field label="Visibility">
            <select className="select" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
              <option value="public">Public — anyone can join</option>
              <option value="private">Private — request to join</option>
            </select>
          </Field>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void create()} disabled={creating || !form.name.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
