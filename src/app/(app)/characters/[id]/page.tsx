'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { Alert, Avatar, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  universe: string;
  personality: string;
  greeting: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function CharacterChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ item: Character }>(`/api/characters/${params.id}`);
      setCharacter(data.item);
      const chat = await api<{ messages: Message[]; aiConfigured: boolean }>(`/api/characters/${params.id}/chat`);
      setMessages(chat.messages ?? []);
      setAiConfigured(chat.aiConfigured);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      const data = await api<{ reply: string; messages: Message[] }>(`/api/characters/${params.id}/chat`, {
        body: { content: text },
      });
      setMessages(data.messages ?? []);
    } catch (err) {
      push((err as Error).message, 'error');
      await load();
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      await api(`/api/characters/${params.id}/chat`, { method: 'DELETE' });
      setMessages([]);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!character) return null;

  return (
    <div className="page-narrow stack" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <Avatar src={character.avatar_url} name={character.name} size={40} />
          <div>
            <strong>{character.name}</strong>
            <div className="tiny muted">{character.universe || 'Original character'}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => void clear()}>Clear</button>
          <button className="btn btn-sm btn-ghost" onClick={() => router.push('/characters')}>← Back</button>
        </div>
      </div>

      {!aiConfigured && (
        <Alert>
          No AI provider is configured on the server, so replies are unavailable. Set <code>AI_API_KEY</code> (and
          optionally <code>AI_BASE_URL</code> / <code>AI_MODEL</code>) in the hosting environment. Your messages are
          not sent while this is missing.
        </Alert>
      )}

      <div className="card card-pad grow" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <p className="tiny muted">{character.greeting || `Start a conversation with ${character.name}.`}</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role === 'user' ? 'bubble-me' : ''}`}>
            {message.content}
          </div>
        ))}
        {sending && <p className="tiny muted">{character.name} is writing…</p>}
        <div ref={endRef} />
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder={`Message ${character.name}…`}
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
