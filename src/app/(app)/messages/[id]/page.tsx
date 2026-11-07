'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, timeAgo } from '@/lib/client';
import { Alert, Avatar, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  media_url: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  is_group: number;
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const { push } = useToast();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ conversation: Conversation; items: Message[]; members: Member[] }>(
        `/api/messages/${params.id}`,
      );
      setConversation(data.conversation);
      setItems(data.items ?? []);
      setMembers(data.members ?? []);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
    api<{ user: { id: string } | null }>('/api/auth/session')
      .then((data) => setMeId(data.user?.id ?? null))
      .catch(() => {});
    api(`/api/messages/${params.id}`, { method: 'PUT' }).catch(() => {});
  }, [load, params.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  const send = async (mediaUrl?: string) => {
    if (!draft.trim() && !mediaUrl) return;
    setSending(true);
    try {
      await api(`/api/messages/${params.id}`, {
        body: { body: draft.trim(), mediaUrl },
      });
      setDraft('');
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const upload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string }>('/api/upload', { formData });
      await send(result.url);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="page-narrow stack" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="row-between">
        <div>
          <h1 style={{ marginBottom: 0, fontSize: 20 }}>
            {conversation?.is_group ? conversation.title || 'Group chat' : members[0]?.display_name ?? 'Conversation'}
          </h1>
          {conversation?.is_group ? (
            <span className="tiny muted">{members.length} members</span>
          ) : members[0] ? (
            <Link href={`/u/${members[0].username}`} className="tiny muted">@{members[0].username}</Link>
          ) : null}
        </div>
        <Link href="/messages" className="btn btn-sm btn-ghost">← Inbox</Link>
      </div>

      <div className="card card-pad grow" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 && <p className="tiny muted">No messages yet. Say hello.</p>}
        {items.map((message) => {
          const mine = message.sender_id === meId;
          const author = members.find((member) => member.user_id === message.sender_id);
          return (
            <div key={message.id} className={`bubble ${mine ? 'bubble-me' : ''}`}>
              {!mine && author && <span className="tiny muted">{author.display_name}</span>}
              {message.media_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.media_url} alt="" style={{ maxWidth: 240, borderRadius: 12, display: 'block', marginBottom: 4 }} />
              )}
              {message.body && <div style={{ whiteSpace: 'pre-wrap' }}>{message.body}</div>}
              <span className="tiny muted-2">{timeAgo(message.created_at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} aria-label="Send image">🖼</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <input
          className="input"
          placeholder="Write a message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={() => void send()} disabled={sending || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
