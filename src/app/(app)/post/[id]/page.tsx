'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, timeAgo } from '@/lib/client';
import { Alert, Avatar, Empty, Spinner } from '@/components/ui';
import { PostCard, PostItem } from '@/components/post-card';
import { useToast } from '@/components/providers';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [post, setPost] = useState<PostItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ item: PostItem; comments: Comment[] }>(`/api/posts/${params.id}`);
      setPost(data.item);
      setComments(data.comments ?? []);
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

  const comment = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api(`/api/posts/${params.id}`, {
        body: { action: 'comment', content: draft.trim(), parentId: replyTo?.id },
      });
      setDraft('');
      setReplyTo(null);
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const removePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api(`/api/posts/${params.id}`, { method: 'DELETE' });
      push('Post deleted');
      router.push('/feed');
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const roots = comments.filter((entry) => !entry.parent_id);
  const replies = (id: string) => comments.filter((entry) => entry.parent_id === id);

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!post) return <Empty title="Post not found" hint="It may have been deleted or is private." />;

  return (
    <div className="page-narrow stack">
      <button className="btn btn-sm btn-ghost" onClick={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        ← Back
      </button>

      <PostCard post={post} onChanged={load} />

      <div className="card card-pad stack">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Write a comment…'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void comment();
              }
            }}
          />
          <button className="btn btn-primary" onClick={() => void comment()} disabled={sending || !draft.trim()}>
            Send
          </button>
        </div>
        {replyTo && (
          <button className="btn btn-sm btn-ghost" onClick={() => setReplyTo(null)} style={{ alignSelf: 'flex-start' }}>
            Cancel reply to @{replyTo.username}
          </button>
        )}

        <div className="divider" />
        <strong className="tiny">{comments.length} comments</strong>

        {roots.length === 0 ? (
          <p className="tiny muted">No comments yet. Start the conversation.</p>
        ) : (
          roots.map((entry) => (
            <div key={entry.id} className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Avatar src={entry.avatar_url} name={entry.display_name} size={32} />
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <Link href={`/u/${entry.username}`} style={{ color: 'inherit' }}>
                      <strong className="tiny">{entry.display_name}</strong>
                    </Link>
                    <span className="tiny muted-2">{timeAgo(entry.created_at)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0' }}>{entry.content}</p>
                  <button className="btn btn-sm btn-ghost" onClick={() => setReplyTo(entry)}>Reply</button>
                </div>
              </div>
              {replies(entry.id).map((reply) => (
                <div key={reply.id} className="row" style={{ gap: 10, alignItems: 'flex-start', marginLeft: 42 }}>
                  <Avatar src={reply.avatar_url} name={reply.display_name} size={32} />
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <Link href={`/u/${reply.username}`} style={{ color: 'inherit' }}>
                        <strong className="tiny">{reply.display_name}</strong>
                      </Link>
                      <span className="tiny muted-2">{timeAgo(reply.created_at)}</span>
                    </div>
                    <p style={{ margin: '2px 0 0' }}>{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {post.user_id && (
        <button className="btn btn-sm btn-danger" onClick={() => void removePost()} style={{ alignSelf: 'flex-start' }}>
          Delete post
        </button>
      )}
    </div>
  );
}
