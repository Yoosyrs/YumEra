'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert, Empty, Field, Modal, Spinner } from './ui';
import { useToast } from './providers';

export interface RMField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'image' | 'tags' | 'color' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  rows?: number;
  hint?: string;
  required?: boolean;
  full?: boolean;
}

export interface RMItem {
  id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ResourceManagerProps {
  resource: string;
  fields: RMField[];
  title: string;
  subtitle: string;
  singular: string;
  emptyTitle: string;
  emptyHint: string;
  titleKey: string;
  subtitleKey?: string;
  imageKey?: string;
  badgeKey?: string;
  metaKeys?: string[];
  detailBase?: string;
  extraActions?: (item: RMItem) => React.ReactNode;
  intro?: React.ReactNode;
}

function blank(fields: RMField[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'select') draft[field.key] = field.options?.[0]?.value ?? '';
    else if (field.type === 'checkbox') draft[field.key] = '0';
    else if (field.type === 'date') draft[field.key] = new Date().toISOString().slice(0, 10);
    else if (field.type === 'color') draft[field.key] = '#b892ff';
    else if (field.type === 'number') draft[field.key] = '0';
    else draft[field.key] = '';
  }
  return draft;
}

/** Shared, fully wired CRUD surface for every user-owned Yume resource. */
export function ResourceManager({
  resource,
  fields,
  title,
  subtitle,
  singular,
  emptyTitle,
  emptyHint,
  titleKey,
  subtitleKey,
  imageKey,
  badgeKey,
  metaKeys = [],
  detailBase,
  extraActions,
  intro,
}: ResourceManagerProps) {
  const { push } = useToast();
  const [items, setItems] = useState<RMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RMItem | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => blank(fields));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ items: RMItem[] }>(`/api/${resource}?limit=100`);
      setItems(data.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      fields.some((field) => String(item[field.key] ?? '').toLowerCase().includes(needle)),
    );
  }, [items, query, fields]);

  const openCreate = () => {
    setEditing(null);
    setDraft(blank(fields));
    setOpen(true);
  };

  const openEdit = (item: RMItem) => {
    setEditing(item);
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = item[field.key];
      if (field.type === 'checkbox') next[field.key] = value ? '1' : '0';
      else if (field.type === 'tags') next[field.key] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      else next[field.key] = value === null || value === undefined ? '' : String(value);
    }
    setDraft({ ...blank(fields), ...next });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = draft[field.key] ?? '';
        if (field.type === 'checkbox') payload[field.key] = raw === '1';
        else if (field.type === 'tags')
          payload[field.key] = raw
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        else if (field.type === 'number') payload[field.key] = Number(raw) || 0;
        else payload[field.key] = raw;
      }
      if (editing) {
        await api(`/api/${resource}/${editing.id}`, { method: 'PATCH', body: payload });
        push(`${singular} updated`);
      } else {
        await api(`/api/${resource}`, { body: payload });
        push(`${singular} created`);
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: RMItem) => {
    if (!window.confirm(`Delete “${String(item[titleKey] ?? singular)}”? This cannot be undone.`)) return;
    try {
      await api(`/api/${resource}/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      push(`${singular} deleted`);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const duplicate = async (item: RMItem) => {
    try {
      await api('/api/duplicate', { body: { resource, id: item.id } });
      push(`${singular} duplicated`);
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const upload = async (field: RMField, file: File) => {
    setUploading(field.key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string }>('/api/upload', { formData });
      setDraft((prev) => ({ ...prev, [field.key]: result.url }));
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <p className="tiny muted" style={{ margin: 0 }}>{subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New {singular.toLowerCase()}</button>
      </div>

      {intro}

      <div className="row" style={{ gap: 10 }}>
        <input
          className="input"
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="tiny muted nowrap">{filtered.length} saved</span>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty
          title={items.length === 0 ? emptyTitle : 'Nothing matches that search'}
          hint={items.length === 0 ? emptyHint : 'Try another word.'}
          action={
            items.length === 0 ? (
              <button className="btn btn-primary" onClick={openCreate}>+ New {singular.toLowerCase()}</button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-auto">
          {filtered.map((item) => {
            const image = imageKey ? String(item[imageKey] ?? '') : '';
            const badge = badgeKey ? String(item[badgeKey] ?? '') : '';
            return (
              <article key={item.id} className="card card-hover" style={{ overflow: 'hidden' }}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="tile-art" style={{ height: 132, width: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="tile-art" style={{ height: 92 }} aria-hidden>
                    ✦
                  </div>
                )}
                <div className="card-pad stack" style={{ gap: 8 }}>
                  <div className="row-between" style={{ gap: 8 }}>
                    {detailBase ? (
                      <Link href={`${detailBase}/${item.id}`} style={{ color: 'inherit' }}>
                        <strong>{String(item[titleKey] ?? singular)}</strong>
                      </Link>
                    ) : (
                      <strong>{String(item[titleKey] ?? singular)}</strong>
                    )}
                    {badge && <span className="badge">{badge}</span>}
                  </div>
                  {subtitleKey && (
                    <p className="tiny muted" style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {String(item[subtitleKey] ?? '') || '—'}
                    </p>
                  )}
                  {metaKeys.length > 0 && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {metaKeys
                        .map((key) => String(item[key] ?? ''))
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((value, index) => (
                          <span key={`${item.id}-${index}`} className="badge badge-gold">{value}</span>
                        ))}
                    </div>
                  )}
                  <div className="row" style={{ gap: 6, marginTop: 2 }}>
                    <button className="btn btn-sm" onClick={() => openEdit(item)}>Edit</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => void duplicate(item)} title="Duplicate">⧉</button>
                    <button className="btn btn-sm btn-danger" onClick={() => void remove(item)} title="Delete">✕</button>
                    {extraActions?.(item)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        wide
        title={editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
        onClose={() => setOpen(false)}
      >
        <div className="stack">
          {fields.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              {field.type === 'textarea' ? (
                <textarea
                  className="textarea"
                  rows={field.rows ?? 4}
                  value={draft[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              ) : field.type === 'select' ? (
                <select
                  className="select"
                  value={draft[field.key] ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={draft[field.key] === '1'}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.checked ? '1' : '0' }))}
                  />
                  <span className="tiny">{field.hint ?? 'Enabled'}</span>
                </label>
              ) : field.type === 'image' ? (
                <div className="stack" style={{ gap: 8 }}>
                  <input
                    className="input"
                    value={draft[field.key] ?? ''}
                    placeholder="Image URL or upload"
                    onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      type="file"
                      accept="image/*"
                      className="tiny"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(field, file);
                      }}
                    />
                    {uploading === field.key && <span className="tiny muted">Uploading…</span>}
                  </div>
                  {draft[field.key] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft[field.key]} alt="" style={{ height: 110, objectFit: 'cover', borderRadius: 12 }} />
                  )}
                </div>
              ) : field.type === 'color' ? (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    type="color"
                    value={draft[field.key] || '#b892ff'}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    style={{ width: 52, height: 36, background: 'transparent', border: 'none' }}
                  />
                  <input
                    className="input"
                    value={draft[field.key] ?? ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                </div>
              ) : (
                <input
                  className="input"
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={draft[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              )}
            </Field>
          ))}

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : `Create ${singular.toLowerCase()}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
