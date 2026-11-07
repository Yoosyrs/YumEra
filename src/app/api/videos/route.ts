import { makeCollection } from '@/lib/crud';
import type { CollectionConfig } from '@/lib/crud';

/**
 * Video Studio drafts. The timeline (scenes, captions, transitions, music
 * choice) is stored as JSON so a draft reopens exactly as it was saved.
 */
export const VIDEO_COLLECTION = {
  table: 'video_projects',
  owner: 'user_id',
  fields: ['title', 'template', 'timeline', 'duration', 'thumbnail', 'visibility'],
  required: ['title'],
  json: ['timeline'],
  visibilityColumn: 'visibility',
  search: ['title'],
  order: 'updated_at DESC',
  updatedAt: true,
} satisfies CollectionConfig;

export const { GET, POST } = makeCollection(VIDEO_COLLECTION);
