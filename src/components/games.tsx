'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Twenty playable mini-games.
 *
 * Every game is implemented with real rules and local state; scores are reported
 * to the parent so they can be stored per account. No simulated results.
 */

export interface GameProps {
  onScore: (score: number) => void;
}

const rand = (max: number) => Math.floor(Math.random() * max);

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function useTicker(active: boolean, ms: number, tick: () => void) {
  const ref = useRef(tick);
  ref.current = tick;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

function EndCard({ score, onRestart, label = 'Play again' }: { score: number; onRestart: () => void; label?: string }) {
  return (
    <div className="game-over">
      <strong>{score} points</strong>
      <button className="btn btn-sm btn-primary" onClick={onRestart}>{label}</button>
    </div>
  );
}

/* 1. Starfall ------------------------------------------------------------ */
function Starfall({ onScore }: GameProps) {
  const [stars, setStars] = useState<Array<{ id: number; x: number; y: number; speed: number }>>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(40);
  const [over, setOver] = useState(false);
  const nextId = useRef(1);

  useTicker(!over && time > 0, 55, () => {
    setStars((current) =>
      current
        .map((star) => ({ ...star, y: star.y + star.speed }))
        .filter((star) => star.y < 100)
        .concat(
          Math.random() < 0.16
            ? [{ id: nextId.current++, x: 4 + rand(90), y: -4, speed: 0.9 + Math.random() * 1.6 }]
            : [],
        ),
    );
  });
  useTicker(!over && time > 0, 1000, () => setTime((value) => value - 1));
  useEffect(() => {
    if (time <= 0 && !over) {
      setOver(true);
      onScore(score);
    }
  }, [time, over, score, onScore]);

  return (
    <div className="stack">
      <div className="game-hud"><span>⏱ {time}s</span><span>★ {score}</span></div>
      <div className="game-field" style={{ height: 320, position: 'relative', overflow: 'hidden' }}>
        {stars.map((star) => (
          <button
            key={star.id}
            className="star-btn"
            style={{ left: `${star.x}%`, top: `${star.y}%` }}
            onClick={() => {
              setStars((current) => current.filter((entry) => entry.id !== star.id));
              setScore((value) => value + 1);
            }}
            aria-label="Catch star"
          >
            ✦
          </button>
        ))}
        {over && <EndCard score={score} onRestart={() => { setStars([]); setScore(0); setTime(40); setOver(false); }} />}
      </div>
      <p className="tiny muted">Catch the falling stars before they leave the sky.</p>
    </div>
  );
}

/* 2. Memory constellation ------------------------------------------------ */
function MemoryConstellation({ onScore }: GameProps) {
  const glyphs = ['✦', '✧', '❋', '☾', '☽', '✵', '❖', '✹'];
  const [cards, setCards] = useState(() => shuffle([...glyphs, ...glyphs].map((glyph, index) => ({ id: index, glyph }))));
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const flip = (id: number) => {
    if (open.length === 2 || open.includes(id) || done.includes(id)) return;
    const next = [...open, id];
    setOpen(next);
    if (next.length === 2) {
      setMoves((value) => value + 1);
      const [a, b] = next;
      if (cards[a].glyph === cards[b].glyph) {
        const solved = [...done, a, b];
        setDone(solved);
        setOpen([]);
        if (solved.length === cards.length) onScore(Math.max(10, 120 - moves * 6));
      } else {
        window.setTimeout(() => setOpen([]), 700);
      }
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Moves: {moves}</span><span>{done.length / 2}/{cards.length / 2} pairs</span></div>
      <div className="memory-grid">
        {cards.map((card, index) => {
          const visible = open.includes(index) || done.includes(index);
          return (
            <button key={card.id} className={`memory-card ${visible ? 'is-open' : ''}`} onClick={() => flip(index)}>
              {visible ? card.glyph : '·'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 3. Soul quiz ----------------------------------------------------------- */
const QUIZ = [
  { q: 'What does “yumeshipping” mean?', options: ['Shipping real people', 'Loving a fictional character', 'A music genre'], answer: 1 },
  { q: 'An F/O is…', options: ['A fictional other', 'A forum owner', 'A font style'], answer: 0 },
  { q: 'A yumesona is…', options: ['A self-insert persona', 'A song', 'A moderator'], answer: 0 },
  { q: 'Anti-double preferences control…', options: ['Other people’s feelings', 'Your own visibility settings', 'Server access'], answer: 1 },
  { q: 'Selfshipping is about…', options: ['Shipping yourself with a character', 'Shipping two strangers', 'Shipping a ship'], answer: 0 },
];

function SoulQuiz({ onScore }: GameProps) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (option: number) => {
    if (picked !== null) return;
    setPicked(option);
    const correct = option === QUIZ[index].answer;
    const nextScore = correct ? score + 1 : score;
    if (correct) setScore(nextScore);
    window.setTimeout(() => {
      if (index + 1 >= QUIZ.length) onScore(nextScore * 20);
      else {
        setIndex(index + 1);
        setPicked(null);
      }
    }, 650);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Question {index + 1}/{QUIZ.length}</span><span>{score} correct</span></div>
      <p><strong>{QUIZ[index].q}</strong></p>
      <div className="stack" style={{ gap: 6 }}>
        {QUIZ[index].options.map((option, optionIndex) => (
          <button
            key={option}
            className={`btn btn-sm ${picked === optionIndex ? (optionIndex === QUIZ[index].answer ? 'btn-primary' : '') : ''}`}
            onClick={() => choose(optionIndex)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 4. Word weaver --------------------------------------------------------- */
const WORDS = ['UNIVERSE', 'STARLIGHT', 'MOONLIT', 'YUMESONA', 'ETERNAL', 'VELVET', 'CELESTIAL', 'PORTRAIT'];

function WordWeaver({ onScore }: GameProps) {
  const [round, setRound] = useState(0);
  const [word, setWord] = useState(() => WORDS[rand(WORDS.length)]);
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const scrambled = useMemo(() => shuffle(word.split('')).join(''), [word]);

  const submit = () => {
    if (guess.trim().toUpperCase() !== word) return;
    const next = score + 1;
    setScore(next);
    setGuess('');
    if (round + 1 >= 5) onScore(next * 25);
    else {
      setRound(round + 1);
      setWord(WORDS[rand(WORDS.length)]);
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Round {round + 1}/5</span><span>{score} solved</span></div>
      <p className="word-scramble">{scrambled}</p>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          value={guess}
          placeholder="Unscramble the word"
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
        />
        <button className="btn btn-sm btn-primary" onClick={submit}>Check</button>
      </div>
    </div>
  );
}

/* 5. Moonlit 2048 -------------------------------------------------------- */
function Moonlit2048({ onScore }: GameProps) {
  const empty = () => Array(16).fill(0);
  const spawn = (board: number[]) => {
    const free = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
    if (free.length === 0) return board;
    const next = [...board];
    next[free[rand(free.length)]] = Math.random() < 0.9 ? 2 : 4;
    return next;
  };
  const [board, setBoard] = useState(() => spawn(spawn(empty())));
  const [score, setScore] = useState(0);

  const slide = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      setBoard((current) => {
        const lines: number[][] = [];
        for (let i = 0; i < 4; i += 1) {
          if (direction === 'left' || direction === 'right') {
            lines.push([0, 1, 2, 3].map((j) => current[i * 4 + j]));
          } else {
            lines.push([0, 1, 2, 3].map((j) => current[j * 4 + i]));
          }
        }
        let gained = 0;
        const merged = lines.map((line) => {
          const values = (direction === 'left' || direction === 'up' ? line : [...line].reverse()).filter((value) => value !== 0);
          const result: number[] = [];
          for (let i = 0; i < values.length; i += 1) {
            if (values[i] === values[i + 1]) {
              result.push(values[i] * 2);
              gained += values[i] * 2;
              i += 1;
            } else {
              result.push(values[i]);
            }
          }
          while (result.length < 4) result.push(0);
          return direction === 'left' || direction === 'up' ? result : result.reverse();
        });
        const next = Array(16).fill(0);
        merged.forEach((line, i) => {
          line.forEach((value, j) => {
            if (direction === 'left' || direction === 'right') next[i * 4 + j] = value;
            else next[j * 4 + i] = value;
          });
        });
        if (next.some((value, index) => value !== current[index])) {
          setScore((value) => {
            const total = value + gained;
            onScore(total);
            return total;
          });
          return spawn(next);
        }
        return current;
      });
    },
    [onScore],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      };
      if (map[event.key]) {
        event.preventDefault();
        slide(map[event.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slide]);

  return (
    <div className="stack">
      <div className="game-hud"><span>Score {score}</span><span>Use arrow keys</span></div>
      <div className="grid-2048">
        {board.map((value, index) => (
          <div key={index} className={`tile tile-${Math.min(value, 2048)}`}>{value || ''}</div>
        ))}
      </div>
      <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
        <button className="btn btn-sm" onClick={() => slide('left')}>←</button>
        <button className="btn btn-sm" onClick={() => slide('up')}>↑</button>
        <button className="btn btn-sm" onClick={() => slide('down')}>↓</button>
        <button className="btn btn-sm" onClick={() => slide('right')}>→</button>
      </div>
    </div>
  );
}

/* 6. Heartbeat reflex ---------------------------------------------------- */
function HeartbeatReflex({ onScore }: GameProps) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'ready' | 'result'>('idle');
  const [started, setStarted] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const timer = useRef<number | null>(null);

  const begin = () => {
    setPhase('waiting');
    timer.current = window.setTimeout(() => {
      setStarted(performance.now());
      setPhase('ready');
    }, 900 + rand(2200));
  };

  const hit = () => {
    if (phase === 'waiting') {
      if (timer.current) window.clearTimeout(timer.current);
      setPhase('idle');
      return;
    }
    if (phase !== 'ready') return;
    const elapsed = Math.round(performance.now() - started);
    const next = [...times, elapsed];
    setTimes(next);
    if (next.length >= 3) {
      const average = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
      onScore(Math.max(0, 900 - average));
      setPhase('result');
    } else {
      setPhase('idle');
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Round {Math.min(times.length + 1, 3)}/3</span><span>{times.join('ms · ') || '—'}</span></div>
      <button
        className={`reflex-pad ${phase === 'ready' ? 'is-ready' : ''}`}
        onClick={phase === 'idle' || phase === 'result' ? begin : hit}
      >
        {phase === 'ready' ? 'NOW!' : phase === 'waiting' ? 'Wait…' : phase === 'result' ? 'Tap to restart' : 'Tap to start'}
      </button>
      <p className="tiny muted">Tap as soon as the sigil lights up. Three rounds.</p>
    </div>
  );
}

/* 7. Yume match ---------------------------------------------------------- */
const MATCH_COLORS = ['#b892ff', '#ff9ecb', '#ffd479', '#8ee6d0'];

function YumeMatch({ onScore }: GameProps) {
  const size = 6;
  const build = () => Array.from({ length: size * size }, () => rand(MATCH_COLORS.length));
  const [grid, setGrid] = useState(build);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const resolve = (next: number[]) => {
    let changed = true;
    let cleared = 0;
    while (changed) {
      changed = false;
      const remove = new Set<number>();
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size - 2; c += 1) {
          const a = next[r * size + c];
          if (a === next[r * size + c + 1] && a === next[r * size + c + 2]) {
            remove.add(r * size + c); remove.add(r * size + c + 1); remove.add(r * size + c + 2);
          }
        }
      }
      for (let c = 0; c < size; c += 1) {
        for (let r = 0; r < size - 2; r += 1) {
          const a = next[r * size + c];
          if (a === next[(r + 1) * size + c] && a === next[(r + 2) * size + c]) {
            remove.add(r * size + c); remove.add((r + 1) * size + c); remove.add((r + 2) * size + c);
          }
        }
      }
      if (remove.size > 0) {
        changed = true;
        cleared += remove.size;
        remove.forEach((index) => { next[index] = rand(MATCH_COLORS.length); });
      }
    }
    if (cleared > 0) {
      setScore((value) => {
        const total = value + cleared * 5;
        onScore(total);
        return total;
      });
    }
  };

  const click = (index: number) => {
    if (selected === null) { setSelected(index); return; }
    const adjacent =
      Math.abs((selected % size) - (index % size)) + Math.abs(Math.floor(selected / size) - Math.floor(index / size)) === 1;
    if (adjacent) {
      const next = [...grid];
      [next[selected], next[index]] = [next[index], next[selected]];
      setGrid(next);
      resolve(next);
    }
    setSelected(null);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Score {score}</span><span>Swap adjacent gems</span></div>
      <div className="match-grid">
        {grid.map((color, index) => (
          <button
            key={index}
            className={`match-cell ${selected === index ? 'is-selected' : ''}`}
            style={{ background: MATCH_COLORS[color] }}
            onClick={() => click(index)}
            aria-label="Gem"
          />
        ))}
      </div>
    </div>
  );
}

/* 8. Runes of fate ------------------------------------------------------- */
function RunesOfFate({ onScore }: GameProps) {
  const runes = ['☾', '✦', '❖'];
  const beats: Record<string, string> = { '☾': '✦', '✦': '❖', '❖': '☾' };
  const [round, setRound] = useState(0);
  const [player, setPlayer] = useState(0);
  const [rival, setRival] = useState(0);
  const [message, setMessage] = useState('Choose a rune.');

  const play = (rune: string) => {
    const foe = runes[rand(3)];
    if (rune === foe) setMessage(`Both drew ${rune} — a draw.`);
    else if (beats[rune] === foe) {
      setPlayer((value) => value + 1);
      setMessage(`${rune} defeats ${foe}. You win the round.`);
    } else {
      setRival((value) => value + 1);
      setMessage(`${foe} defeats ${rune}. The universe favours your rival.`);
    }
    const next = round + 1;
    setRound(next);
    if (next >= 5) {
      const finalScore = Math.max(0, player * 20 - rival * 10);
      onScore(finalScore);
      setMessage(`Best of five finished: ${player}–${rival}.`);
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>You {player}</span><span>Rival {rival}</span><span>Round {Math.min(round + 1, 5)}/5</span></div>
      <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
        {runes.map((rune) => (
          <button key={rune} className="rune-btn" onClick={() => play(rune)} disabled={round >= 5}>{rune}</button>
        ))}
      </div>
      <p className="tiny muted" style={{ textAlign: 'center' }}>{message}</p>
    </div>
  );
}

/* 9. Echo sequence ------------------------------------------------------- */
function EchoSequence({ onScore }: GameProps) {
  const pads = ['#b892ff', '#ff9ecb', '#ffd479', '#8ee6d0'];
  const [sequence, setSequence] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const playSequence = useCallback((seq: number[]) => {
    setPlaying(true);
    seq.forEach((pad, index) => {
      window.setTimeout(() => setFlash(pad), 420 * index + 200);
      window.setTimeout(() => setFlash(null), 420 * index + 560);
    });
    window.setTimeout(() => {
      setPlaying(false);
      setStep(0);
    }, 420 * seq.length + 300);
  }, []);

  const start = () => {
    const seq = [rand(4)];
    setSequence(seq);
    playSequence(seq);
  };

  const tap = (pad: number) => {
    if (playing || sequence.length === 0) return;
    if (sequence[step] !== pad) {
      onScore(sequence.length * 10);
      setSequence([]);
      return;
    }
    if (step + 1 === sequence.length) {
      const next = [...sequence, rand(4)];
      setSequence(next);
      window.setTimeout(() => playSequence(next), 400);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Length {sequence.length}</span><span>{playing ? 'Watch…' : 'Your turn'}</span></div>
      <div className="echo-grid">
        {pads.map((color, index) => (
          <button
            key={color}
            className={`echo-pad ${flash === index ? 'is-flash' : ''}`}
            style={{ background: color }}
            onClick={() => tap(index)}
            aria-label={`Pad ${index + 1}`}
          />
        ))}
      </div>
      <button className="btn btn-sm btn-primary" onClick={start}>{sequence.length ? 'Restart' : 'Start'}</button>
    </div>
  );
}

/* 10. Petal catcher ------------------------------------------------------ */
function PetalCatcher({ onScore }: GameProps) {
  const [items, setItems] = useState<Array<{ id: number; x: number; y: number; thorn: boolean }>>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const nextId = useRef(1);

  useTicker(time > 0, 70, () => {
    setItems((current) =>
      current
        .map((item) => ({ ...item, y: item.y + 1.6 }))
        .filter((item) => {
          if (item.y > 100) {
            if (!item.thorn) setScore((value) => Math.max(0, value - 0));
            return false;
          }
          return true;
        })
        .concat(
          Math.random() < 0.3
            ? [{ id: nextId.current++, x: 6 + rand(88), y: -5, thorn: Math.random() < 0.3 }]
            : [],
        ),
    );
  });
  useTicker(time > 0, 1000, () => setTime((value) => value - 1));
  useEffect(() => {
    if (time <= 0) onScore(score);
  }, [time, score, onScore]);

  return (
    <div className="stack">
      <div className="game-hud"><span>⏱ {time}s</span><span>✿ {score}</span></div>
      <div className="game-field" style={{ height: 320, position: 'relative', overflow: 'hidden' }}>
        {items.map((item) => (
          <button
            key={item.id}
            className="petal"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onClick={() => {
              setItems((current) => current.filter((entry) => entry.id !== item.id));
              setScore((value) => Math.max(0, value + (item.thorn ? -2 : 1)));
            }}
          >
            {item.thorn ? '✖' : '✿'}
          </button>
        ))}
      </div>
      <p className="tiny muted">Catch petals, avoid thorns.</p>
    </div>
  );
}

/* 11. Glyph pairs -------------------------------------------------------- */
function GlyphPairs({ onScore }: GameProps) {
  const glyphs = ['❀', '❁', '✾', '✿', '❃', '❋'];
  const deck = useMemo(
    () => shuffle(glyphs.flatMap((glyph) => [glyph, glyph, glyph]).map((glyph, index) => ({ id: index, glyph }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);

  const flip = (id: number) => {
    if (open.includes(id) || done.includes(id) || open.length === 3) return;
    const next = [...open, id];
    setOpen(next);
    if (next.length === 3) {
      setAttempts((value) => value + 1);
      const same = next.every((index) => deck[index].glyph === deck[next[0]].glyph);
      if (same) {
        const solved = [...done, ...next];
        setDone(solved);
        setOpen([]);
        if (solved.length === deck.length) onScore(Math.max(20, 180 - attempts * 8));
      } else {
        window.setTimeout(() => setOpen([]), 700);
      }
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Attempts {attempts}</span><span>{done.length / 3}/6 trios</span></div>
      <div className="memory-grid">
        {deck.map((card, index) => {
          const visible = open.includes(index) || done.includes(index);
          return (
            <button key={card.id} className={`memory-card ${visible ? 'is-open' : ''}`} onClick={() => flip(index)}>
              {visible ? card.glyph : '·'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 12. Orbit dodge -------------------------------------------------------- */
function OrbitDodge({ onScore }: GameProps) {
  const [ship, setShip] = useState(1);
  const [rocks, setRocks] = useState<Array<{ id: number; lane: number; y: number }>>([]);
  const [time, setTime] = useState(30);
  const [alive, setAlive] = useState(true);
  const nextId = useRef(1);

  useTicker(alive && time > 0, 90, () => {
    setRocks((current) => {
      const moved = current.map((rock) => ({ ...rock, y: rock.y + 4 }));
      const hit = moved.find((rock) => rock.y > 78 && rock.y < 96 && rock.lane === ship);
      if (hit) setAlive(false);
      return moved.filter((rock) => rock.y < 100).concat(
        Math.random() < 0.28 ? [{ id: nextId.current++, lane: rand(3), y: 0 }] : [],
      );
    });
  });
  useTicker(alive && time > 0, 1000, () => setTime((value) => value - 1));
  useEffect(() => {
    if ((!alive || time <= 0) && time >= 0) onScore(Math.max(0, (30 - time) * 3 + (alive ? 20 : 0)));
  }, [alive, time, onScore]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setShip((lane) => Math.max(0, lane - 1));
      if (event.key === 'ArrowRight') setShip((lane) => Math.min(2, lane + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="stack">
      <div className="game-hud"><span>⏱ {time}s</span><span>{alive ? 'Surviving' : 'Crashed'}</span></div>
      <div className="orbit-field">
        {rocks.map((rock) => (
          <span key={rock.id} className="rock" style={{ left: `${16 + rock.lane * 34}%`, top: `${rock.y}%` }}>✹</span>
        ))}
        <span className="ship" style={{ left: `${16 + ship * 34}%` }}>▲</span>
      </div>
      <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
        <button className="btn btn-sm" onClick={() => setShip((lane) => Math.max(0, lane - 1))}>←</button>
        <button className="btn btn-sm" onClick={() => setShip((lane) => Math.min(2, lane + 1))}>→</button>
      </div>
    </div>
  );
}

/* 13. Lullaby simon ------------------------------------------------------ */
function LullabySimon({ onScore }: GameProps) {
  const notes = [523.25, 587.33, 659.25, 783.99];
  const [sequence, setSequence] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const tone = (index: number, duration = 0.4) => {
    try {
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[index];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.05);
    } catch {
      /* audio blocked */
    }
  };

  const playSequence = useCallback((seq: number[]) => {
    setPlaying(true);
    seq.forEach((note, index) => window.setTimeout(() => tone(note), 500 * index));
    window.setTimeout(() => { setPlaying(false); setStep(0); }, 500 * seq.length + 200);
  }, []);

  const start = () => {
    const seq = [rand(4)];
    setSequence(seq);
    playSequence(seq);
  };

  const tap = (note: number) => {
    if (playing || sequence.length === 0) return;
    tone(note, 0.3);
    if (sequence[step] !== note) {
      onScore(sequence.length * 15);
      setSequence([]);
      return;
    }
    if (step + 1 === sequence.length) {
      const next = [...sequence, rand(4)];
      setSequence(next);
      window.setTimeout(() => playSequence(next), 450);
    } else setStep(step + 1);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Length {sequence.length}</span><span>{playing ? 'Listen…' : 'Repeat'}</span></div>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        {notes.map((note, index) => (
          <button key={note} className="lullaby-key" onClick={() => tap(index)} aria-label={`Note ${index + 1}`}>
            ♪
          </button>
        ))}
      </div>
      <button className="btn btn-sm btn-primary" onClick={start}>{sequence.length ? 'Restart' : 'Start'}</button>
    </div>
  );
}

/* 14. Constellation trace ------------------------------------------------ */
function ConstellationTrace({ onScore }: GameProps) {
  const points = useMemo(
    () => shuffle(Array.from({ length: 12 }, (_, index) => index + 1)),
    [],
  );
  const [next, setNext] = useState(1);
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (started === null) return;
    const id = window.setInterval(() => setElapsed(Date.now() - started), 100);
    return () => window.clearInterval(id);
  }, [started]);

  const click = (value: number) => {
    if (value !== next) return;
    if (started === null) setStarted(Date.now());
    if (next === 12) {
      const time = Date.now() - (started ?? Date.now());
      onScore(Math.max(10, 200 - Math.round(time / 100)));
    }
    setNext(next + 1);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Next {Math.min(next, 12)}</span><span>{(elapsed / 1000).toFixed(1)}s</span></div>
      <div className="constellation-grid">
        {points.map((value) => (
          <button
            key={value}
            className={`constellation-star ${value < next ? 'is-done' : ''}`}
            onClick={() => click(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 15. Dream sort --------------------------------------------------------- */
function DreamSort({ onScore }: GameProps) {
  const [numbers, setNumbers] = useState(() => shuffle(Array.from({ length: 9 }, (_, index) => index + 1)));
  const [next, setNext] = useState(1);
  const [mistakes, setMistakes] = useState(0);

  const click = (value: number) => {
    if (value !== next) { setMistakes((count) => count + 1); return; }
    if (next === 9) {
      onScore(Math.max(10, 120 - mistakes * 10));
      setNumbers(shuffle(Array.from({ length: 9 }, (_, index) => index + 1)));
      setNext(1);
      setMistakes(0);
    } else setNext(next + 1);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Next {next}</span><span>Mistakes {mistakes}</span></div>
      <div className="sort-grid">
        {numbers.map((value) => (
          <button key={value} className={`sort-cell ${value < next ? 'is-done' : ''}`} onClick={() => click(value)}>
            {value}
          </button>
        ))}
      </div>
      <p className="tiny muted">Tap the numbers in ascending order.</p>
    </div>
  );
}

/* 16. Aurora tiles ------------------------------------------------------- */
function AuroraTiles({ onScore }: GameProps) {
  const size = 9;
  const [pattern, setPattern] = useState<number[]>([]);
  const [flash, setFlash] = useState<number[]>([]);
  const [input, setInput] = useState<number[]>([]);
  const [watching, setWatching] = useState(false);

  const round = (length: number) => {
    const next = shuffle(Array.from({ length: size }, (_, index) => index)).slice(0, length);
    setPattern(next);
    setInput([]);
    setWatching(true);
    setFlash(next);
    window.setTimeout(() => setFlash([]), 900);
    window.setTimeout(() => setWatching(false), 1000);
  };

  const tap = (index: number) => {
    if (watching || pattern.length === 0) return;
    if (!pattern.includes(index)) return;
    const next = [...input, index];
    setInput(next);
    if (next.length === pattern.length) {
      if (pattern.every((value) => next.includes(value))) {
        onScore(pattern.length * 12);
        window.setTimeout(() => round(Math.min(size, pattern.length + 1)), 400);
      } else {
        setPattern([]);
      }
    }
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Level {pattern.length || 1}</span><span>{watching ? 'Memorise' : 'Reproduce'}</span></div>
      <div className="aurora-grid">
        {Array.from({ length: size }, (_, index) => (
          <button
            key={index}
            className={`aurora-tile ${flash.includes(index) ? 'is-flash' : ''} ${input.includes(index) ? 'is-picked' : ''}`}
            onClick={() => tap(index)}
            aria-label={`Tile ${index + 1}`}
          />
        ))}
      </div>
      <button className="btn btn-sm btn-primary" onClick={() => round(3)}>Start</button>
    </div>
  );
}

/* 17. Shooting stars ----------------------------------------------------- */
function ShootingStars({ onScore }: GameProps) {
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [zone] = useState(() => 35 + rand(25));

  useTicker(round < 5, 16, () => {
    setPos((value) => {
      const next = value + dir * 1.6;
      if (next > 100) { setDir(-1); return 100; }
      if (next < 0) { setDir(1); return 0; }
      return next;
    });
  });

  const stop = () => {
    if (round >= 5) return;
    const success = Math.abs(pos - zone) < 9;
    const nextHits = hits + (success ? 1 : 0);
    setHits(nextHits);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= 5) onScore(nextHits * 20);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Round {Math.min(round + 1, 5)}/5</span><span>{hits} hits</span></div>
      <div className="timing-track">
        <span className="timing-zone" style={{ left: `${zone - 9}%`, width: '18%' }} />
        <span className="timing-marker" style={{ left: `${pos}%` }} />
      </div>
      <button className="btn btn-sm btn-primary" onClick={stop} disabled={round >= 5}>Release</button>
    </div>
  );
}

/* 18. Veil of numbers ---------------------------------------------------- */
function VeilOfNumbers({ onScore }: GameProps) {
  const make = () => {
    const a = 2 + rand(18);
    const b = 2 + rand(18);
    const ops = ['+', '−', '×'] as const;
    const op = ops[rand(3)];
    const answer = op === '+' ? a + b : op === '−' ? a - b : a * b;
    return { question: `${a} ${op} ${b}`, answer };
  };
  const [problem, setProblem] = useState(make);
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(45);

  useTicker(time > 0, 1000, () => setTime((value) => value - 1));
  useEffect(() => {
    if (time <= 0) onScore(score * 10);
  }, [time, score, onScore]);

  const submit = () => {
    if (Number(guess) === problem.answer) setScore((value) => value + 1);
    setGuess('');
    setProblem(make());
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>⏱ {time}s</span><span>{score} solved</span></div>
      <p className="math-question">{problem.question}</p>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          inputMode="numeric"
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
          placeholder="Answer"
        />
        <button className="btn btn-sm btn-primary" onClick={submit}>→</button>
      </div>
    </div>
  );
}

/* 19. Yume solitaire ----------------------------------------------------- */
function YumeSolitaire({ onScore }: GameProps) {
  const values = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const [cards, setCards] = useState(() =>
    shuffle(values.flatMap((value) => [value, value]).map((value, index) => ({ id: index, value, removed: false }))),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);

  const click = (id: number) => {
    if (cards[id].removed) return;
    if (selected === null) { setSelected(id); return; }
    if (selected === id) { setSelected(null); return; }
    if (cards[selected].value === cards[id].value) {
      const next = cards.map((card) => (card.id === selected || card.id === id ? { ...card, removed: true } : card));
      setCards(next);
      setMoves((value) => value + 1);
      if (next.every((card) => card.removed)) onScore(Math.max(10, 200 - moves * 8));
    }
    setSelected(null);
  };

  return (
    <div className="stack">
      <div className="game-hud"><span>Moves {moves}</span><span>{cards.filter((card) => card.removed).length / 2}/8 pairs</span></div>
      <div className="solitaire-grid">
        {cards.map((card, index) => (
          <button
            key={card.id}
            className={`solitaire-card ${card.removed ? 'is-gone' : ''} ${selected === index ? 'is-selected' : ''}`}
            onClick={() => click(index)}
          >
            {card.removed ? '' : card.value}
          </button>
        ))}
      </div>
      <p className="tiny muted">Match two cards of the same value. Cards are visible — this is a patience puzzle.</p>
    </div>
  );
}

/* 20. Eternal lanes ------------------------------------------------------ */
function EternalLanes({ onScore }: GameProps) {
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState<Array<{ id: number; lane: number; y: number }>>([]);
  const [distance, setDistance] = useState(0);
  const [alive, setAlive] = useState(true);
  const nextId = useRef(1);

  useTicker(alive, 80, () => {
    setObstacles((current) => {
      const moved = current.map((obstacle) => ({ ...obstacle, y: obstacle.y + 5 }));
      if (moved.some((obstacle) => obstacle.y > 80 && obstacle.y < 97 && obstacle.lane === lane)) setAlive(false);
      return moved.filter((obstacle) => obstacle.y < 100).concat(
        Math.random() < 0.3 ? [{ id: nextId.current++, lane: rand(3), y: 0 }] : [],
      );
    });
    setDistance((value) => value + 1);
  });
  useEffect(() => {
    if (!alive) onScore(distance);
  }, [alive, distance, onScore]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'a' || event.key === 'ArrowLeft') setLane((value) => Math.max(0, value - 1));
      if (event.key === 'd' || event.key === 'ArrowRight') setLane((value) => Math.min(2, value + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="stack">
      <div className="game-hud"><span>Distance {distance}m</span><span>{alive ? 'Running' : 'Stopped'}</span></div>
      <div className="lane-field">
        {obstacles.map((obstacle) => (
          <span key={obstacle.id} className="lane-obstacle" style={{ left: `${12 + obstacle.lane * 30}%`, top: `${obstacle.y}%` }}>◈</span>
        ))}
        <span className="lane-runner" style={{ left: `${12 + lane * 30}%` }}>✦</span>
      </div>
      <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
        <button className="btn btn-sm" onClick={() => setLane((value) => Math.max(0, value - 1))}>←</button>
        <button className="btn btn-sm" onClick={() => setLane((value) => Math.min(2, value + 1))}>→</button>
      </div>
    </div>
  );
}

export interface GameDef {
  id: string;
  title: string;
  blurb: string;
  tag: string;
  Component: (props: GameProps) => React.ReactElement;
}

export const GAMES: GameDef[] = [
  { id: 'starfall', title: 'Starfall', blurb: 'Catch falling stars before they fade.', tag: 'Reflex', Component: Starfall },
  { id: 'memory-constellation', title: 'Memory Constellation', blurb: 'Pair the celestial glyphs.', tag: 'Memory', Component: MemoryConstellation },
  { id: 'soul-quiz', title: 'Soul Quiz', blurb: 'Five questions about yume culture.', tag: 'Trivia', Component: SoulQuiz },
  { id: 'word-weaver', title: 'Word Weaver', blurb: 'Unscramble five universe words.', tag: 'Words', Component: WordWeaver },
  { id: 'moonlit-2048', title: 'Moonlit 2048', blurb: 'Merge moonlit tiles to 2048.', tag: 'Puzzle', Component: Moonlit2048 },
  { id: 'heartbeat-reflex', title: 'Heartbeat Reflex', blurb: 'Measure your reaction time.', tag: 'Reflex', Component: HeartbeatReflex },
  { id: 'yume-match', title: 'Yume Match', blurb: 'Swap gems to line up three.', tag: 'Puzzle', Component: YumeMatch },
  { id: 'runes-of-fate', title: 'Runes of Fate', blurb: 'Best of five against the universe.', tag: 'Chance', Component: RunesOfFate },
  { id: 'echo-sequence', title: 'Echo Sequence', blurb: 'Repeat the growing light pattern.', tag: 'Memory', Component: EchoSequence },
  { id: 'petal-catcher', title: 'Petal Catcher', blurb: 'Catch petals, avoid the thorns.', tag: 'Reflex', Component: PetalCatcher },
  { id: 'glyph-pairs', title: 'Glyph Pairs', blurb: 'Find trios of matching sigils.', tag: 'Memory', Component: GlyphPairs },
  { id: 'orbit-dodge', title: 'Orbit Dodge', blurb: 'Weave between falling rocks.', tag: 'Arcade', Component: OrbitDodge },
  { id: 'lullaby-simon', title: 'Lullaby Simon', blurb: 'Repeat the melody you hear.', tag: 'Audio', Component: LullabySimon },
  { id: 'constellation-trace', title: 'Constellation Trace', blurb: 'Connect the stars in order.', tag: 'Speed', Component: ConstellationTrace },
  { id: 'dream-sort', title: 'Dream Sort', blurb: 'Tap numbers from one upwards.', tag: 'Speed', Component: DreamSort },
  { id: 'aurora-tiles', title: 'Aurora Tiles', blurb: 'Memorise the glowing tiles.', tag: 'Memory', Component: AuroraTiles },
  { id: 'shooting-stars', title: 'Shooting Stars', blurb: 'Stop the marker in the light.', tag: 'Timing', Component: ShootingStars },
  { id: 'veil-of-numbers', title: 'Veil of Numbers', blurb: 'Solve as many sums as you can.', tag: 'Math', Component: VeilOfNumbers },
  { id: 'yume-solitaire', title: 'Yume Solitaire', blurb: 'Clear the deck by matching values.', tag: 'Cards', Component: YumeSolitaire },
  { id: 'eternal-lanes', title: 'Eternal Lanes', blurb: 'Run the endless corridor.', tag: 'Arcade', Component: EternalLanes },
];
