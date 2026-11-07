'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'title', label: 'Gallery title', required: true, placeholder: 'Portraits of the Silver Court' },
  { key: 'visibility', label: 'Visibility', type: 'select', options: [
    { value: 'public', label: 'Public' },
    { value: 'followers', label: 'Followers only' },
    { value: 'private', label: 'Only me' },
  ] },
  { key: 'cover_url', label: 'Cover', type: 'image' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
];

export default function GalleryPage() {
  return (
    <ResourceManager
      resource="galleries"
      title="Gallery"
      subtitle="Albums of portraits, illustrations and videos."
      singular="gallery"
      emptyTitle="No galleries yet"
      emptyHint="Create an album, then add images or videos inside it."
      titleKey="title"
      subtitleKey="description"
      imageKey="cover_url"
      badgeKey="visibility"
      detailBase="/gallery"
      fields={fields}
    />
  );
}
