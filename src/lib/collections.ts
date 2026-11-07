import type { CollectionConfig } from './crud';

/**
 * Server-side whitelist of user-owned resources.
 * Clients can never choose a table: only one of these keys.
 */
export const COLLECTIONS = {
  yumesonas: {
    table: 'yumesonas',
    owner: 'user_id',
    fields: [
      'name',
      'tagline',
      'description',
      'biography',
      'personality',
      'universe',
      'story',
      'relationships',
      'traits',
      'image_url',
      'gallery',
      'visibility',
    ],
    required: ['name'],
    json: ['traits', 'gallery'],
    visibilityColumn: 'visibility',
    search: ['name', 'tagline', 'universe', 'description', 'personality'],
    order: 'updated_at DESC',
    updatedAt: true,
  } satisfies CollectionConfig,

  fos: {
    table: 'fo_characters',
    owner: 'user_id',
    fields: [
      'name',
      'source_work',
      'yumesona_id',
      'relationship_type',
      'description',
      'preferences',
      'anti_double_notes',
      'anti_double',
      'portrait_url',
      'visibility',
    ],
    required: ['name'],
    visibilityColumn: 'visibility',
    search: ['name', 'source_work', 'description', 'relationship_type'],
  } satisfies CollectionConfig,

  stories: {
    table: 'stories',
    owner: 'user_id',
    fields: ['title', 'cover_url', 'description', 'tags', 'visibility', 'status'],
    required: ['title'],
    visibilityColumn: 'visibility',
    search: ['title', 'description', 'tags'],
    order: 'updated_at DESC',
    updatedAt: true,
  } satisfies CollectionConfig,

  galleries: {
    table: 'galleries',
    owner: 'user_id',
    fields: ['title', 'description', 'cover_url', 'visibility'],
    required: ['title'],
    visibilityColumn: 'visibility',
    search: ['title', 'description'],
  } satisfies CollectionConfig,

  diary: {
    table: 'diary_entries',
    owner: 'user_id',
    fields: ['title', 'body', 'mood', 'tags', 'media_url', 'entry_date'],
    required: ['title'],
    ownerOnly: true,
    search: ['title', 'body', 'tags', 'mood'],
    order: 'entry_date DESC, created_at DESC',
  } satisfies CollectionConfig,

  memories: {
    table: 'memories',
    owner: 'user_id',
    fields: ['title', 'description', 'media_url', 'memory_type', 'character_name', 'yumesona_id', 'fo_id', 'happened_on'],
    required: ['title'],
    ownerOnly: true,
    search: ['title', 'description', 'character_name'],
    order: 'COALESCE(happened_on, created_at) DESC',
  } satisfies CollectionConfig,

  lore: {
    table: 'lore_entries',
    owner: 'user_id',
    fields: ['title', 'body', 'category', 'tags', 'visibility'],
    required: ['title'],
    visibilityColumn: 'visibility',
    search: ['title', 'body', 'tags', 'category'],
  } satisfies CollectionConfig,

  playlists: {
    table: 'music_playlists',
    owner: 'user_id',
    fields: ['title', 'description', 'cover_url', 'is_public', 'generated_by'],
    required: ['title'],
    search: ['title', 'description'],
  } satisfies CollectionConfig,

  portraits: {
    table: 'portrait_projects',
    owner: 'user_id',
    fields: ['title', 'mode', 'style', 'canvas', 'thumbnail', 'folder_id', 'visibility'],
    required: ['title'],
    visibilityColumn: 'visibility',
    search: ['title'],
    order: 'updated_at DESC',
    updatedAt: true,
  } satisfies CollectionConfig,

  folders: {
    table: 'portrait_folders',
    owner: 'user_id',
    fields: ['name'],
    required: ['name'],
    ownerOnly: true,
    order: 'created_at ASC',
  } satisfies CollectionConfig,

  characters: {
    table: 'characters',
    owner: 'user_id',
    fields: [
      'name',
      'avatar_url',
      'personality',
      'biography',
      'universe',
      'story',
      'speech_style',
      'behavior_rules',
      'greeting',
      'model',
      'temperature',
      'visibility',
    ],
    required: ['name'],
    visibilityColumn: 'visibility',
    search: ['name', 'universe', 'personality'],
  } satisfies CollectionConfig,

  children: {
    table: 'family_children',
    owner: 'user_id',
    fields: ['fo_id', 'yumesona_id', 'name', 'gender', 'traits', 'palette', 'portrait', 'story'],
    required: ['name'],
    json: ['traits', 'palette'],
    ownerOnly: true,
  } satisfies CollectionConfig,
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

/** Tables that support "duplicate" from the library views. */
export const DUPLICABLE: Record<string, CollectionKey> = {
  yumesona: 'yumesonas',
  fo: 'fos',
  story: 'stories',
  portrait: 'portraits',
  playlist: 'playlists',
  character: 'characters',
  gallery: 'galleries',
  lore: 'lore',
};
