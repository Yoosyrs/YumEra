'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Alert, Empty, Field, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Option {
  id: string;
  name: string;
  source_work?: string;
}

interface Child {
  id: string;
  name: string;
  gender: string;
  traits: string;
  palette: string;
  portrait: string | null;
  story: string;
  fo_id: string | null;
  yumesona_id: string | null;
}

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function FamilyPage() {
  const { push } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [fos, setFos] = useState<Option[]>([]);
  const [yumesonas, setYumesonas] = useState<Option[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [foId, setFoId] = useState('');
  const [yumesonaId, setYumesonaId] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{
        children: Child[];
        fos: Option[];
        yumesonas: Option[];
        aiConfigured: boolean;
      }>('/api/family/generate');
      setChildren(data.children ?? []);
      setFos(data.fos ?? []);
      setYumesonas(data.yumesonas ?? []);
      setAiConfigured(data.aiConfigured);
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

  const generate = async () => {
    if (!foId) return;
    setGenerating(true);
    try {
      await api('/api/family/generate', {
        body: { foId, yumesonaId: yumesonaId || undefined, notes: notes || undefined },
      });
      setNotes('');
      push('A new child joined your universe');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this child from your universe?')) return;
    try {
      await api(`/api/children/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="page-narrow stack">
      <div>
        <h1 style={{ marginBottom: 2 }}>Yume Family</h1>
        <p className="tiny muted" style={{ margin: 0 }}>
          Create the child of your F/O and your yumesona. Traits are derived from both characters and their palettes.
        </p>
      </div>

      <div className="card card-pad stack">
        {!aiConfigured && (
          <p className="tiny muted" style={{ margin: 0 }}>
            No AI provider configured: names, traits and palettes are generated locally from both characters. Add
            <code> AI_API_KEY </code> on the server to enrich the backstory.
          </p>
        )}
        <Field label="F/O parent" required>
          <select className="select" value={foId} onChange={(event) => setFoId(event.target.value)}>
            <option value="">Choose an F/O…</option>
            {fos.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Yumesona parent">
          <select className="select" value={yumesonaId} onChange={(event) => setYumesonaId(event.target.value)}>
            <option value="">Use my own self-insert</option>
            {yumesonas.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes for this child" hint="Optional: personality hints, universe details.">
          <textarea className="textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <button className="btn btn-primary" onClick={() => void generate()} disabled={generating || !foId}>
          {generating ? 'Creating…' : 'Create our child'}
        </button>
        {fos.length === 0 && (
          <p className="tiny muted">Add an F/O in the registry first.</p>
        )}
      </div>

      {children.length === 0 ? (
        <Empty title="No children yet" hint="Choose an F/O to create your first child." />
      ) : (
        <div className="grid grid-auto">
          {children.map((child) => {
            const traits = parseList(child.traits);
            const palette = parseList(child.palette);
            return (
              <div key={child.id} className="card card-pad stack" style={{ gap: 6 }}>
                <div className="row-between">
                  <strong>{child.name}</strong>
                  <button className="btn btn-sm btn-ghost" onClick={() => void remove(child.id)}>✕</button>
                </div>
                <span className="tiny muted">{child.gender}</span>
                {child.portrait && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={child.portrait} alt="" style={{ width: '100%', borderRadius: 12 }} />
                )}
                <div className="row" style={{ gap: 4 }}>
                  {palette.map((color, index) => (
                    <span key={`${color}-${index}`} style={{ width: 18, height: 18, borderRadius: 6, background: color }} />
                  ))}
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {traits.map((trait) => <span key={trait} className="badge">{trait}</span>)}
                </div>
                <p className="tiny" style={{ margin: 0 }}>{child.story}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
