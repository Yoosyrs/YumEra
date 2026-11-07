import { COLLECTIONS } from '@/lib/collections';
import { makeCollection } from '@/lib/crud';

export const { GET, POST } = makeCollection(COLLECTIONS.diary);
