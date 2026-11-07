'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { Alert, Empty, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Gallery {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  visibility: string;
}

interface Item {
  id: string;
  media_url: string;
  media_type: string;
  caption: string;
  created_at: string;
}

export default function GalleryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Item | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ item: Gallery }>(`/api/galleries/${params.id}`);
      setGallery(data.item);
      const list = await api<{ items: Item[] }>(`/api/galleries/${params.id}/items`);
      setItems(list.items ?? []);
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

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await api<{ url: string }>('/api/upload', { formData });
      await api(`/api/galleries/${params.id}/items`, {
        body: {
          mediaUrl: uploaded.url,
          mediaType: file.type.startsWith('video') ? 'video' : 'image',
          caption: caption.trim() || undefined,
        },
      });
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      push('Added to gallery');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (itemId: string) => {
    if (!window.confirm('Remove this item?')) return;
    try {
      await api(`/api/galleries/${params.id}/items?itemId=${itemId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!gallery) return <Empty title="Gallery not found" />;

  return (
    <div className="page-narrow stack">
      <button className="btn btn-sm btn-ghost" onClick={() => router.push('/gallery')} style={{ alignSelf: 'flex-start' }}>
        ← All galleries
      </button>

      <div>
        <h1 style={{ marginBottom: 2 }}>{gallery.title}</h1>
        <p className="tiny muted" style={{ margin: 0 }}>{gallery.description || gallery.visibility}</p>
      </div>

      <div className="card card-pad stack">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Caption (optional)"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '+ Add image / video'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <Empty title="This gallery is empty" hint="Add your first portrait or illustration." />
      ) : (
        <div className="grid grid-auto">
          {items.map((item) => (
            <div key={item.id} className="card" style={{ overflow: 'hidden' }}>
              <button
                onClick={() => setLightbox(item)}
                style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}
              >
                {item.media_type === 'video' ? (
                  <video src={item.media_url} className="tile-art" style={{ height: 180, width: '100%', objectFit: 'cover' }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.media_url} alt={item.caption} className="tile-art" style={{ height: 180, width: '100%', objectFit: 'cover' }} />
                )}
              </button>
              <div className="card-pad row-between">
                <span className="tiny muted">{item.caption || 'Untitled'}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => void remove(item.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: 900, width: '100%' }} onClick={(event) => event.stopPropagation()}>
            {lightbox.media_type === 'video' ? (
              <video src={lightbox.media_url} controls autoPlay style={{ width: '100%', borderRadius: 16 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.media_url} alt={lightbox.caption} style={{ width: '100%', borderRadius: 16 }} />
            )}
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="tiny">{lightbox.caption}</span>
              <button className="btn btn-sm" onClick={() => setLightbox(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
