'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/client';
import { Alert, Avatar, Empty, Field, Modal, Spinner } from '@/components/ui';
import { PostCard, PostItem } from '@/components/post-card';
import { useToast } from '@/components/providers';

interface ProfileData {
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string;
    pronouns: string;
    avatar_url: string | null;
    cover_url: string | null;
    soul_color: string;
    is_private: number;
    created_at: string;
  };
  counts: { posts: number; followers: number; following: number };
  isFollowing: boolean;
  isSelf: boolean;
  friendState: string | null;
  blocked: boolean;
  gated: boolean;
  posts: PostItem[];
  yumesonas: Array<{ id: string; name: string; tagline: string; image_url: string | null }>;
  fos: Array<{ id: string; character_name: string; source_work: string; portrait_url: string | null }>;
  stories: Array<{ id: string; title: string; summary: string }>;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { push } = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'posts' | 'yume' | 'stories'>('posts');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<ProfileData>(`/api/users/${params.username}`);
      setData(result);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.username]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (path: string, body: Record<string, unknown>, message: string) => {
    if (!data) return;
    setBusy(true);
    try {
      await api(path, { body });
      push(message);
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    if (!data || !reportReason.trim()) return;
    await act(
      '/api/blocks',
      { action: 'report', userId: data.profile.id, reason: reportReason.trim() },
      'Report sent to moderation',
    );
    setReportOpen(false);
    setReportReason('');
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Empty title="Profile not found" />;

  const { profile, counts } = data;

  return (
    <div className="page-narrow stack">
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          className="cover"
          style={{
            height: 150,
            background: profile.cover_url
              ? `url(${profile.cover_url}) center/cover`
              : `linear-gradient(135deg, ${profile.soul_color || '#3a1e5c'}, #120818)`,
          }}
        />
        <div className="card-pad stack">
          <div className="row-between" style={{ marginTop: -46, alignItems: 'flex-end' }}>
            <div style={{ border: '3px solid var(--bg-1)', borderRadius: '50%' }}>
              <Avatar src={profile.avatar_url} name={profile.display_name} size={88} />
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {data.isSelf ? (
                <Link href="/settings" className="btn btn-sm">Edit profile</Link>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        '/api/follow',
                        { userId: profile.id },
                        data.isFollowing ? 'Unfollowed' : 'Following',
                      )
                    }
                  >
                    {data.isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        '/api/friends',
                        {
                          action: data.friendState === 'accepted' ? 'remove' : 'request',
                          userId: profile.id,
                        },
                        data.friendState === 'accepted' ? 'Friend removed' : 'Friend request sent',
                      )
                    }
                  >
                    {data.friendState === 'accepted'
                      ? 'Friends'
                      : data.friendState === 'pending'
                        ? 'Request sent'
                        : 'Add friend'}
                  </button>
                  <Link href={`/messages?to=${profile.username}`} className="btn btn-sm">Message</Link>
                  <button className="btn btn-sm btn-ghost" onClick={() => setReportOpen(true)} aria-label="Report">⚑</button>
                </>
              )}
            </div>
          </div>

          <div>
            <h1 style={{ marginBottom: 2 }}>{profile.display_name}</h1>
            <div className="row" style={{ gap: 8 }}>
              <span className="tiny muted">@{profile.username}</span>
              {profile.pronouns && <span className="badge">{profile.pronouns}</span>}
              {Boolean(profile.is_private) && <span className="badge badge-warn">Private</span>}
            </div>
          </div>

          {profile.bio && <p style={{ margin: 0 }}>{profile.bio}</p>}

          <div className="row" style={{ gap: 16 }}>
            <span className="tiny"><strong>{counts.posts}</strong> posts</span>
            <span className="tiny"><strong>{counts.followers}</strong> followers</span>
            <span className="tiny"><strong>{counts.following}</strong> following</span>
          </div>
        </div>
      </div>

      {data.gated ? (
        <Empty
          title="This account is private"
          hint="Follow this person to see their posts, yumesonas and stories."
        />
      ) : (
        <>
          <div className="tabs">
            <button className={`chip ${tab === 'posts' ? 'chip-static active' : ''}`} onClick={() => setTab('posts')}>
              Posts
            </button>
            <button className={`chip ${tab === 'yume' ? 'chip-static active' : ''}`} onClick={() => setTab('yume')}>
              Yume
            </button>
            <button className={`chip ${tab === 'stories' ? 'chip-static active' : ''}`} onClick={() => setTab('stories')}>
              Stories
            </button>
          </div>

          {tab === 'posts' &&
            (data.posts.length === 0 ? (
              <Empty title="No posts yet" hint="When they share something it will appear here." />
            ) : (
              data.posts.map((post) => <PostCard key={post.id} post={post} onChanged={load} />)
            ))}

          {tab === 'yume' && (
            <div className="stack">
              <h2 style={{ fontSize: 15 }}>Yumesonas</h2>
              {data.yumesonas.length === 0 ? (
                <p className="tiny muted">No public yumesonas.</p>
              ) : (
                <div className="grid grid-auto">
                  {data.yumesonas.map((entry) => (
                    <div key={entry.id} className="card card-hover" style={{ overflow: 'hidden' }}>
                      {entry.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.image_url} alt="" className="tile-art" style={{ height: 120, width: '100%', objectFit: 'cover' }} />
                      )}
                      <div className="card-pad">
                        <strong>{entry.name}</strong>
                        <p className="tiny muted" style={{ margin: 0 }}>{entry.tagline}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h2 style={{ fontSize: 15 }}>F/O Registry</h2>
              {data.fos.length === 0 ? (
                <p className="tiny muted">No public F/O entries.</p>
              ) : (
                <div className="grid grid-auto">
                  {data.fos.map((entry) => (
                    <div key={entry.id} className="card card-pad">
                      <strong>{entry.character_name}</strong>
                      <p className="tiny muted" style={{ margin: 0 }}>{entry.source_work}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'stories' && (
            <div className="stack">
              {data.stories.length === 0 ? (
                <Empty title="No public stories" />
              ) : (
                data.stories.map((story) => (
                  <Link key={story.id} href={`/stories/${story.id}`} className="card card-pad card-hover" style={{ color: 'inherit' }}>
                    <strong>{story.title}</strong>
                    <p className="tiny muted" style={{ margin: 0 }}>{story.summary}</p>
                  </Link>
                ))
              )}
            </div>
          )}
        </>
      )}

      <Modal open={reportOpen} title="Report this account" onClose={() => setReportOpen(false)}>
        <div className="stack">
          <Field label="What happened?" hint="Reports go to moderation. False reports may be ignored.">
            <textarea
              className="textarea"
              rows={4}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Describe the problem…"
            />
          </Field>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setReportOpen(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => void report()} disabled={!reportReason.trim()}>
              Send report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
