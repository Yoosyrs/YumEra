'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Empty, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';
import { GAMES } from '@/components/games';

interface Stats {
  best: Record<string, number>;
  global: Record<string, number>;
  played: number;
}

export default function GamesPage() {
  const toast = useToast();
  const [stats, setStats] = useState<Stats>({ best: {}, global: {}, played: 0 });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Stats>('/api/games');
      setStats({ best: data.best ?? {}, global: data.global ?? {}, played: data.played ?? 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitScore = useCallback(
    async (gameId: string, score: number) => {
      setLastScore(score);
      try {
        await api('/api/games', { method: 'POST', body: { gameId, score } });
        toast.push(`${score} points saved`, 'success');
        await load();
      } catch (error) {
        toast.push(error instanceof Error ? error.message : 'Could not save score', 'error');
      }
    },
    [load, toast],
  );

  const active = GAMES.find((game) => game.id === activeId) ?? null;
  const totalBest = Object.values(stats.best).reduce((sum, value) => sum + value, 0);

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Yume Arcade</h1>
          <p className="muted">Twenty original mini-games. Your best score for each one is stored on your account.</p>
        </div>
        <div className="stat-pill">
          <span className="tiny muted">Total best</span>
          <strong>{totalBest}</strong>
        </div>
      </div>

      {active ? (
        <section className="card stack">
          <div className="row between">
            <div>
              <h2 className="h2">{active.title}</h2>
              <p className="tiny muted">{active.blurb}</p>
            </div>
            <button className="btn btn-sm" onClick={() => { setActiveId(null); setLastScore(null); }}>Close</button>
          </div>
          <active.Component onScore={(score) => void submitScore(active.id, score)} />
          {lastScore !== null && (
            <p className="tiny muted">Last run: {lastScore} points · best {stats.best[active.id] ?? 0}</p>
          )}
        </section>
      ) : (
        <div className="grid-auto">
          {GAMES.map((game) => (
            <article key={game.id} className="card stack game-card">
              <div className="row between">
                <span className="chip">{game.tag}</span>
                <span className="tiny muted">Best {stats.best[game.id] ?? 0}</span>
              </div>
              <h3 className="h3">{game.title}</h3>
              <p className="tiny muted">{game.blurb}</p>
              <div className="row between">
                <button className="btn btn-sm btn-primary" onClick={() => { setActiveId(game.id); setLastScore(null); }}>Play</button>
                <span className="tiny muted">{stats.global[game.id] ?? 0} plays</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {GAMES.length === 0 && <Empty title="No games yet" hint="The arcade is being prepared." />}
      <p className="tiny muted">
        Looking for something else? <Link href="/feed" className="link">Back to your feed</Link>.
      </p>
    </div>
  );
}
