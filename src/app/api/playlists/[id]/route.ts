import { COLLECTIONS } from '@/lib/collections';
import { makeItem } from '@/lib/crud';

export const { GET, PATCH, DELETE } = makeItem({ ...COLLECTIONS.playlists, name: 'playlists' });
