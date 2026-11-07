'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, formatDate } from '@/lib/client';
import { Alert, Avatar, Empty, Field, Modal, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';

interface Community {
  id: string;
  name: string;
  description: string;
  rules: string;
  visibility: string;
  member_count: number;
}

interface Member {
  user_id: string;
  role: string;
  status: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Event {
  id: string;
  title: string;
  description: string;
  starts_at: string;
}

interface Post {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export default function CommunityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [data, setData] = useState<{
    community: Community;
    membership: { role: string; status: string } | null;
    isAdmin: boolean;
    isMember: boolean;
    members: Member[];
    events: Event[];
    posts: Post[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', startsAt: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<NonNullable<typeof data>>(`/api/communities/${params.id}`);
      setData(result);
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

  const act = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api(`/api/communities/${params.id}`, { body });
      push(message);
      await load();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  const { community, membership, isAdmin, isMember, members, events, posts } = data;
  const pending = members.filter((member) => member.status === 'pending');
  const active = members.filter((member) => member.status === 'active');

  return (
    <div className="page-narrow stack">
      <button className="btn btn-sm btn-ghost" onClick={() => router.push('/communities')} style={{ alignSelf: 'flex-start' }}>
        ← All communities
      </button>

      <div className="card card-pad stack">
        <div className="row-between">
          <h1 style={{ margin: 0 }}>{community.name}</h1>
          <span className="badge">{community.visibility}</span>
        </div>
        <p style={{ margin: 0 }}>{community.description}</p>
        <span className="tiny muted">{active.length} members</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {!membership && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act({ action: 'join' }, 'Joined community')}>
              {community.visibility === 'private' ? 'Request to join' : 'Join'}
            </button>
          )}
          {membership && (
            <button className="btn btn-sm" disabled={busy} onClick={() => void act({ action: 'leave' }, 'Left community')}>
              Leave
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setEventOpen(true)}>+ Event</button>
          )}
        </div>
        {membership?.status === 'pending' && <p className="tiny muted">Your request is waiting for an admin.</p>}
      </div>

      {community.rules && (
        <div className="card card-pad stack">
          <strong>Rules</strong>
          <div style={{ whiteSpace: 'pre-wrap' }}>{community.rules}</div>
        </div>
      )}

      {isAdmin && (
        <div className="card card-pad stack">
          <strong>Invite a member</strong>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="@username" value={invite} onChange={(event) => setInvite(event.target.value)} />
            <button
              className="btn btn-sm"
              disabled={busy || !invite.trim()}
              onClick={() => {
                void act({ action: 'invite', username: invite.trim() }, 'Invitation sent');
                setInvite('');
              }}
            >
              Invite
            </button>
          </div>
          {pending.length > 0 && (
            <>
              <div className="divider" />
              <strong>Join requests</strong>
              {pending.map((member) => (
                <div key={member.user_id} className="row-between">
                  <Link href={`/u/${member.username}`} style={{ color: 'inherit' }} className="tiny">
                    {member.display_name} @{member.username}
                  </Link>
                  <span className="row" style={{ gap: 6 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => void act({ action: 'approve', userId: member.user_id }, 'Approved')}>
                      Approve
                    </button>
                    <button className="btn btn-sm" onClick={() => void act({ action: 'reject', userId: member.user_id }, 'Rejected')}>
                      Reject
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="card card-pad stack">
        <strong>Events</strong>
        {events.length === 0 ? (
          <p className="tiny muted">No events scheduled.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="stack" style={{ gap: 2 }}>
              <strong className="tiny">{event.title}</strong>
              <span className="tiny muted-2">{formatDate(event.starts_at)}</span>
              {event.description && <p className="tiny" style={{ margin: 0 }}>{event.description}</p>}
            </div>
          ))
        )}
      </div>

      <div className="stack">
        <strong>Members</strong>
        <div className="grid grid-auto">
          {active.map((member) => (
            <Link key={member.user_id} href={`/u/${member.username}`} className="card card-pad row" style={{ gap: 8, color: 'inherit' }}>
              <Avatar src={member.avatar_url} name={member.display_name} size={32} />
              <span style={{ minWidth: 0 }}>
                <span className="tiny" style={{ display: 'block' }}>{member.display_name}</span>
                <span className="tiny muted-2">{member.role}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="stack">
        <strong>Community posts</strong>
        {posts.length === 0 ? (
          <Empty title="No posts yet" hint="Community posts appear here." />
        ) : (
          posts.map((post) => (
            <Link key={post.id} href={`/post/${post.id}`} className="card card-pad stack" style={{ color: 'inherit', gap: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <Avatar src={post.avatar_url} name={post.display_name} size={28} />
                <strong className="tiny">{post.display_name}</strong>
                <span className="tiny muted-2">{formatDate(post.created_at)}</span>
              </div>
              <p style={{ margin: 0 }}>{post.content}</p>
              {post.media_url && post.media_type === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.media_url} alt="" className="post-media" />
              )}
            </Link>
          ))
        )}
      </div>

      <Modal open={eventOpen} title="New community event" onClose={() => setEventOpen(false)}>
        <div className="stack">
          <Field label="Title" required>
            <input className="input" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} />
          </Field>
          <Field label="Date and time">
            <input className="input" type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="textarea" rows={3} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} />
          </Field>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setEventOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!eventForm.title.trim()}
              onClick={() => {
                void act(
                  { action: 'event', title: eventForm.title, startsAt: eventForm.startsAt, description: eventForm.description },
                  'Event created',
                );
                setEventOpen(false);
                setEventForm({ title: '', startsAt: '', description: '' });
              }}
            >
              Create event
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
