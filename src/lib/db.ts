import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.YUMERA_DATA_DIR || path.join(process.cwd(), 'data');
export const DB_PATH = process.env.YUMERA_DB_PATH || path.join(DATA_DIR, 'yumera.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

declare global {
  // eslint-disable-next-line no-var
  var __yumeraDb: Database.Database | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  pronouns TEXT DEFAULT '',
  locale TEXT DEFAULT 'es',
  is_private INTEGER DEFAULT 0,
  email_verified INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  soul_color TEXT DEFAULT '#b892ff',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  UNIQUE(from_id, to_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT,
  visibility TEXT DEFAULT 'public',
  community_id TEXT,
  share_of TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'heart',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id, kind)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  is_group INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS yumesonas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  biography TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  universe TEXT DEFAULT '',
  story TEXT DEFAULT '',
  relationships TEXT DEFAULT '',
  traits TEXT DEFAULT '[]',
  image_url TEXT,
  gallery TEXT DEFAULT '[]',
  visibility TEXT DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fo_characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_work TEXT DEFAULT '',
  yumesona_id TEXT,
  relationship_type TEXT DEFAULT '',
  description TEXT DEFAULT '',
  preferences TEXT DEFAULT '',
  anti_double_notes TEXT DEFAULT '',
  anti_double INTEGER DEFAULT 1,
  portrait_url TEXT,
  visibility TEXT DEFAULT 'public',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  personality TEXT DEFAULT '',
  biography TEXT DEFAULT '',
  universe TEXT DEFAULT '',
  story TEXT DEFAULT '',
  speech_style TEXT DEFAULT '',
  behavior_rules TEXT DEFAULT '',
  greeting TEXT DEFAULT '',
  model TEXT DEFAULT '',
  temperature REAL DEFAULT 0.8,
  visibility TEXT DEFAULT 'private',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_messages (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  description TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_chapters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_favorites (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(story_id, user_id)
);

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT,
  visibility TEXT DEFAULT 'public',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  caption TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  visibility TEXT DEFAULT 'public',
  cover_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_members (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  joined_at TEXT NOT NULL,
  UNIQUE(community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_events (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  starts_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  media_url TEXT,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  media_url TEXT,
  memory_type TEXT DEFAULT 'memory',
  character_name TEXT DEFAULT '',
  yumesona_id TEXT,
  fo_id TEXT,
  happened_on TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS music_playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT,
  is_public INTEGER DEFAULT 0,
  generated_by TEXT DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  dedication TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS music_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, track_id)
);

CREATE TABLE IF NOT EXISTS portrait_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portrait_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mode TEXT DEFAULT 'character',
  style TEXT DEFAULT 'anime',
  canvas TEXT NOT NULL,
  thumbnail TEXT,
  folder_id TEXT,
  visibility TEXT DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT DEFAULT 'celestial',
  timeline TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  thumbnail TEXT,
  visibility TEXT DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  target_type TEXT,
  target_id TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, category)
);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  muted INTEGER DEFAULT 0,
  sound TEXT DEFAULT 'signature',
  quiet_start TEXT DEFAULT '',
  quiet_end TEXT DEFAULT '',
  push_enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  email TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_tones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_freq INTEGER DEFAULT 880,
  waveform TEXT DEFAULT 'bell',
  decay REAL DEFAULT 1.6,
  sparkle INTEGER DEFAULT 3,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lore_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  category TEXT DEFAULT 'universe',
  tags TEXT DEFAULT '',
  visibility TEXT DEFAULT 'public',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_children (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fo_id TEXT,
  yumesona_id TEXT,
  name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  traits TEXT DEFAULT '[]',
  palette TEXT DEFAULT '[]',
  portrait TEXT DEFAULT '{}',
  story TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
`;

export function db(): Database.Database {
  if (globalThis.__yumeraDb) return globalThis.__yumeraDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const instance = new Database(DB_PATH);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.exec(SCHEMA);
  globalThis.__yumeraDb = instance;
  return instance;
}

export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return db().prepare(sql).run(...params);
}

export function uid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function getSetting(key: string): string | null {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
