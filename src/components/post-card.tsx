'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, formatDate, timeAgo } from '@/lib/client';
import { Avatar } from './ui';
import { useToast } from './providers';

export interface PostItem {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  visibility: string;
  community_id: string | null;
  share_of: string | null;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  reaction_count: number;
  comment_count: number;
  share_count: number;
  reacted?: number;
}

const REACTIONS: Array<{ kind: string; icon: string; label: string }> = [
  { kind: 'heart', icon: '♡', label: 'Heart' },
  { kind: 'star', icon: '★', label: 'Star' },
  { kind: 'moon', icon: '☾', label: 'Moon' },
  { kind: 'sparkle', icon: '✦', label: 'Sparkle' },
];

export function PostCard({
  post,
  onChanged,
  currentUserId,
}: {
  post: PostItem;
  onChanged?: () => void;
  currentUserId?: string;
}) {
  const { push } = useToast();
  const [reacted, setReacted] = useState(Boolean(post.reacted));
  const [count, setCount] = useState(post.reaction_count);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const react = async (kind: string) => {
    setBusy(true);
    try {
      const result = await api<{ reacted: boolean; count: number }>(`/api/posts/${post.id}`, {
        body: { action: 'react', kind },
      });
      setReacted(result.reacted);
      setCount(result.count);
      setPickerOpen(false);
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await api(`/api/posts/${post.id}`, { body: { action: 'share' } });
      push('Shared to your feed');
      onChanged?.();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api(`/api/posts/${post.id}`, { method: 'DELETE' });
      push('Post deleted');
      onChanged?.();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  return (
    <article className="post">
      <header className="post-head">
        <Link href={`/u/${post.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <Avatar src={post.avatar_url} name={post.display_name} size={40} />
        </Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Link href={`/u/${post.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <strong>{post.display_name}</strong>
            </Link>
            <span className="tiny muted">@{post.username}</span>
            {post.visibility === 'private' && <span className="badge">Private</span>}
          </div>
          <span className="tiny muted-2" title={formatDate(post.created_at)}>
            {timeAgo(post.created_at)}
          </span>
        </div>
        {currentUserId === post.user_id && (
          <button className="btn btn-sm btn-ghost" onClick={() => void remove()} aria-label="Delete post">✕</button>
        )}
      </header>

      {post.share_of && (
        <p className="tiny muted-2" style={{ marginTop: -4 }}>
          ✦ Shared a post
        </p>
      )}

      {post.content && (
        <p className="post-body">
          {post.content.split(/(\s+)/).map((chunk, index) =>
            /^@[a-z0-9_]{3,24}$/i.test(chunk) ? (
              <Link key={index} href={`/u/${chunk.slice(1)}`} className="mention">{chunk}</Link>
            ) : /^#[^\s]+$/.test(chunk) ? (
              <Link key={index} href={`/explore?tag=${chunk.slice(1)}`} className="mention">{chunk}</Link>
            ) : (
              <span key={index}>{chunk}</span>
            ),
          )}
        </p>
      )}

      {post.media_url && post.media_type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="post-media" src={post.media_url} alt="" loading="lazy" />
      )}
      {post.media_url && post.media_type === 'video' && (
        <video className="post-media" src={post.media_url} controls playsInline />
      )}

      <div className="post-actions">
        <div style={{ position: 'relative' }}>
          <button
            className={`action-btn ${reacted ? 'active' : ''}`}
            onClick={() => setPickerOpen((prev) => !prev)}
            disabled={busy}
            aria-label="React"
          >
            {reacted ? '♥' : '♡'} {count}
          </button>
          {pickerOpen && (
            <div className="reaction-picker">
              {REACTIONS.map((reaction) => (
                <button key={reaction.kind} title={reaction.label} onClick={() => void react(reaction.kind)}>
                  {reaction.icon}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link className="action-btn" href={`/post/${post.id}`}>💬 {post.comment_count}</Link>
        <button className="action-btn" onClick={() => void share()}>⇄ {post.share_count}</button>
      </div>
    </article>
  );
}
