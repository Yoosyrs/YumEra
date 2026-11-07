'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'title', label: 'Title', required: true, placeholder: 'The Eternal Court' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft (private)' },
    { value: 'published', label: 'Published' },
  ] },
  { key: 'visibility', label: 'Visibility', type: 'select', options: [
    { value: 'public', label: 'Public' },
    { value: 'followers', label: 'Followers only' },
    { value: 'private', label: 'Only me' },
  ] },
  { key: 'cover_url', label: 'Cover', type: 'image' },
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'gothic, romance, angels' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 4, full: true },
];

export default function StoriesPage() {
  return (
    <ResourceManager
      resource="stories"
      title="Stories"
      subtitle="Write serialised stories about your yume, chapter by chapter."
      singular="story"
      emptyTitle="No stories yet"
      emptyHint="Create a story, then open it to write chapters."
      titleKey="title"
      subtitleKey="description"
      imageKey="cover_url"
      badgeKey="status"
      detailBase="/stories"
      fields={fields}
      intro={
        <p className="tiny muted" style={{ margin: 0 }}>
          Drafts stay private. Published stories are readable by everyone (or by followers, if you choose).
        </p>
      }
    />
  );
}
