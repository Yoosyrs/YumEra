'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert, Avatar, Empty, Spinner } from '@/components/ui';
import { PostCard, PostItem } from '@/components/post-card';
import { useToast } from '@/components/providers';

type FeedTab = 'for-you' | 'following';

export default function FeedPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [items, setItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [posting, setPosting] = useState(false);
  const [me, setMe] = useState<{ id: string; display_name: string; avatar_url: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = tab === 'following' ? '?feed=following&limit=30' : '?limit=30';
      const data = await api<{ items: PostItem[] }>(`/api/posts${query}`);
      setItems(data.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<{ user: { id: string; display_name: string; avatar_url: string | null } | null }>('/api/auth/session')
      .then((data) => setMe(data.user))
      .catch(() => setMe(null));
  }, []);

  const uploadFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string; type?: string }>('/api/upload', { formData });
      setMediaUrl(result.url);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const publish = async () => {
    if (!content.trim() && !mediaUrl) {
      push('Write something or add an image first', 'error');
      return;
    }
    setPosting(true);
    try {
      await api('/api/posts', {
        body: {
          content: content.trim(),
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaUrl ? mediaType : undefined,
          visibility,
        },
      });
      setContent('');
      setMediaUrl('');
      if (fileRef.current) fileRef.current.value = '';
      push('Published to your universe');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 2 }}>Yume Feed</h1>
          <p className="tiny muted" style={{ margin: 0 }}>Your universe has something to tell you.</p>
        </div>
        <div className="tabs">
          <button
            className={`chip ${tab === 'for-you' ? 'chip-static active' : ''}`}
            onClick={() => setTab('for-you')}
          >
            For you
          </button>
          <button
            className={`chip ${tab === 'following' ? 'chip-static active' : ''}`}
            onClick={() => setTab('following')}
          >
            Following
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Avatar src={me?.avatar_url ?? null} name={me?.display_name ?? 'You'} size={40} />
          <div className="grow stack" style={{ gap: 8 }}>
            <textarea
              className="textarea"
              rows={3}
              maxLength={2000}
              placeholder="Share a moment, a memory, a piece of your universe…"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            {mediaUrl && (
              <div style={{ position: 'relative' }}>
                {mediaType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="post-media" />
                ) : (
                  <video src={mediaUrl} className="post-media" controls />
                )}
                <button className="btn btn-sm" onClick={() => setMediaUrl('')} style={{ marginTop: 6 }}>
                  Remove media
                </button>
              </div>
            )}
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}>
                  🖼 Photo / video
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
                <Link href="/studio/portrait" className="btn btn-sm btn-ghost">✦ Portrait</Link>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <select
                  className="select"
                  style={{ width: 'auto' }}
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  aria-label="Visibility"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="private">Only me</option>
                </select>
                <button className="btn btn-primary" onClick={() => void publish()} disabled={posting}>
                  {posting ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty
          title="Your feed is quiet"
          hint={tab === 'following' ? 'Follow people in Explore to fill this feed.' : 'Be the first to post something.'}
          action={<Link href="/explore" className="btn btn-primary">Find your people</Link>}
        />
      ) : (
        items.map((post) => (
          <PostCard key={post.id} post={post} onChanged={load} currentUserId={me?.id} />
        ))
      )}
    </div>
  );
}
