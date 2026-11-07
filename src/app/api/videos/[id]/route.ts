import { makeItem } from '@/lib/crud';
import { VIDEO_COLLECTION } from '../route';

export const { GET, PATCH, DELETE } = makeItem({ ...VIDEO_COLLECTION, name: 'video project' });
