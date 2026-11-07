'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { Avatar, Empty, Spinner } from '@/components/ui';

interface SearchResults {
  users: Array<{ id: string; username: string; display_name: string; avatar_url: string | null; bio: string }>;
  posts: Array<{ id: string; content: string; username: string; display_name: string; created_at: string }>;
  yumesonas: Array<{ id: string; name: string; tagline: string; image_url: string | null; username: string }>;
  characters: Array<{ id: string; name: string; universe: string; image_url: string | null }>;
  stories: Array<{ id: string; title: string; summary: string; cover_url: string | null }>;
  communities: Array<{ id: string; name: string; description: string; member_count: number }>;
  playlists: Array<{ id: string; title: string; description: string }>;
  galleries: Array<{ id: string; title: string; description: string }>;
}

const TYPES = [
  { id: 'all', label: 'Everything' },
  { id: 'users', label: 'People' },
  { id: 'yumesonas', label: 'Yumesonas' },
  { id: 'characters', label: 'Characters' },
  { id: 'stories', label: 'Stories' },
  { id: 'communities', label: 'Communities' },
  { id: 'posts', label: 'Posts' },
] as const;

type Type = (typeof TYPES)[number]['id'];

const EMPTY: SearchResults = {
  users: [],
  posts: [],
  yumesonas: [],
  characters: [],
  stories: [],
  communities: [],
  playlists: [],
  galleries: [],
};

export default function ExplorePage() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? params.get('tag') ?? '');
  const [type, setType] = useState<Type>('all');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = useCallback(async (value: string, kind: Type) => {
    setLoading(true);
    try {
      const data = await api<SearchResults>(
        `/api/search?q=${encodeURIComponent(value)}&type=${kind}`,
      );
      setResults({ ...EMPTY, ...data });
      setSearched(true);
    } catch {
      setResults(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run(query, type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const total =
    results.users.length +
    results.posts.length +
    results.yumesonas.length +
    results.characters.length +
    results.stories.length +
    results.communities.length;

  return (
    <div className="page-narrow stack">
      <div>
        <h1 style={{ marginBottom: 2 }}>Explore the universe</h1>
        <p className="tiny muted" style={{ margin: 0 }}>Find people, characters, worlds and stories.</p>
      </div>

      <form
        className="row"
        style={{ gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(query, type);
        }}
      >
        <input
          className="input"
          placeholder="Search @people, yumesonas, characters, tags…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <div className="tabs">
        {TYPES.map((entry) => (
          <button
            key={entry.id}
            className={`chip ${type === entry.id ? 'chip-static active' : ''}`}
            onClick={() => setType(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Searching…" />
      ) : searched && total === 0 ? (
        <Empty title="Nothing found" hint="Try a different word, or check the spelling." />
      ) : (
        <div className="stack">
          {results.users.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>People</h2>
              <div className="grid grid-auto">
                {results.users.map((user) => (
                  <Link key={user.id} href={`/u/${user.username}`} className="card card-pad card-hover row" style={{ gap: 10, color: 'inherit' }}>
                    <Avatar src={user.avatar_url} name={user.display_name} size={40} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{user.display_name}</span>
                      <span className="tiny muted">@{user.username}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.yumesonas.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>Yumesonas</h2>
              <div className="grid grid-auto">
                {results.yumesonas.map((entry) => (
                  <Link key={entry.id} href={`/u/${entry.username}`} className="card card-hover" style={{ color: 'inherit', overflow: 'hidden' }}>
                    {entry.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.image_url} alt="" className="tile-art" style={{ height: 120, width: '100%', objectFit: 'cover' }} />
                    )}
                    <div className="card-pad">
                      <strong>{entry.name}</strong>
                      <p className="tiny muted" style={{ margin: 0 }}>{entry.tagline || 'Yumesona'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.characters.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>Characters</h2>
              <div className="grid grid-auto">
                {results.characters.map((entry) => (
                  <Link key={entry.id} href={`/characters/${entry.id}`} className="card card-pad card-hover" style={{ color: 'inherit' }}>
                    <strong>{entry.name}</strong>
                    <p className="tiny muted" style={{ margin: 0 }}>{entry.universe || 'Original character'}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.stories.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>Stories</h2>
              <div className="grid grid-auto">
                {results.stories.map((entry) => (
                  <Link key={entry.id} href={`/stories/${entry.id}`} className="card card-pad card-hover" style={{ color: 'inherit' }}>
                    <strong>{entry.title}</strong>
                    <p className="tiny muted" style={{ margin: 0 }}>{entry.summary || 'Story'}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.communities.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>Communities</h2>
              <div className="grid grid-auto">
                {results.communities.map((entry) => (
                  <Link key={entry.id} href={`/communities/${entry.id}`} className="card card-pad card-hover" style={{ color: 'inherit' }}>
                    <strong>{entry.name}</strong>
                    <p className="tiny muted" style={{ margin: 0 }}>{entry.description || 'Community'}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.posts.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 15 }}>Posts</h2>
              {results.posts.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`} className="card card-pad card-hover" style={{ color: 'inherit' }}>
                  <strong className="tiny">{post.display_name} @{post.username}</strong>
                  <p style={{ margin: '4px 0 0' }}>{post.content.slice(0, 220)}</p>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
