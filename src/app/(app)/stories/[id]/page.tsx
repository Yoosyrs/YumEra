'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, formatDate } from '@/lib/client';
import { Alert, Empty, Field, Modal, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Story {
  id: string;
  user_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  tags: string;
  status: string;
  visibility: string;
  created_at: string;
}

interface Chapter {
  id: string;
  title: string;
  content: string;
  position: number;
  created_at: string;
}

export default function StoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ item: Story }>(`/api/stories/${params.id}`);
      setStory(data.item);
      try {
        const chapterData = await api<{ chapters: Chapter[] }>(`/api/stories/${params.id}/chapters`);
        setChapters(chapterData.chapters ?? []);
      } catch {
        setChapters([]);
      }
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addChapter = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api(`/api/stories/${params.id}/chapters`, { body: { title: title.trim(), content } });
      setTitle('');
      setContent('');
      setOpen(false);
      push('Chapter saved');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeChapter = async (chapterId: string) => {
    if (!window.confirm('Delete this chapter?')) return;
    try {
      await api(`/api/stories/${params.id}/chapters?chapterId=${chapterId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const togglePublish = async () => {
    if (!story) return;
    try {
      await api(`/api/stories/${params.id}`, {
        method: 'PATCH',
        body: { status: story.status === 'published' ? 'draft' : 'published' },
      });
      push(story.status === 'published' ? 'Moved to drafts' : 'Story published');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!story) return <Empty title="Story not found" />;

  const tags = (() => {
    try {
      const parsed = JSON.parse(story.tags || '[]');
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="page-narrow stack">
      <button className="btn btn-sm btn-ghost" onClick={() => router.push('/stories')} style={{ alignSelf: 'flex-start' }}>
        ← All stories
      </button>

      <div className="card" style={{ overflow: 'hidden' }}>
        {story.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.cover_url} alt="" style={{ width: '100%', height: 190, objectFit: 'cover' }} />
        )}
        <div className="card-pad stack">
          <div className="row-between">
            <h1 style={{ margin: 0 }}>{story.title}</h1>
            <span className={`badge ${story.status === 'published' ? 'badge-ok' : ''}`}>{story.status}</span>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>{formatDate(story.created_at)} · {story.visibility}</p>
          {story.description && <p style={{ margin: 0 }}>{story.description}</p>}
          {tags.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {tags.map((tag) => <span key={tag} className="badge">#{tag}</span>)}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setOpen(true)}>+ Chapter</button>
            <button className="btn btn-sm" onClick={() => void togglePublish()}>
              {story.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {chapters.length === 0 ? (
        <Empty title="No chapters yet" hint="Add the first chapter to begin your story." action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Write chapter 1</button>
        } />
      ) : (
        <div className="stack">
          {chapters.map((chapter, index) => (
            <div key={chapter.id} className="card card-pad stack">
              <div className="row-between">
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, textAlign: 'left' }}
                  onClick={() => setActive(active === chapter.id ? null : chapter.id)}
                >
                  <strong>Chapter {index + 1} — {chapter.title}</strong>
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => void removeChapter(chapter.id)}>Delete</button>
              </div>
              {active === chapter.id && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{chapter.content || 'This chapter is empty.'}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="New chapter" onClose={() => setOpen(false)}>
        <div className="stack">
          <Field label="Chapter title" required>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Chapter text">
            <textarea className="textarea" rows={12} value={content} onChange={(event) => setContent(event.target.value)} />
          </Field>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void addChapter()} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save chapter'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
