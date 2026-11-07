'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'title', label: 'Entry title', required: true },
  { key: 'entry_date', label: 'Date', type: 'date' },
  { key: 'mood', label: 'Mood', placeholder: 'tender, restless, hopeful' },
  { key: 'media_url', label: 'Photo', type: 'image' },
  { key: 'tags', label: 'Tags', type: 'tags' },
  { key: 'body', label: 'Entry', type: 'textarea', rows: 10, full: true, placeholder: 'Write freely. Only you can read this.' },
];

export default function DiaryPage() {
  return (
    <ResourceManager
      resource="diary"
      title="Private Diary"
      subtitle="Your sealed diary. Entries are visible only to your account."
      singular="diary entry"
      emptyTitle="Your diary is empty"
      emptyHint="Write your first entry — it stays private until you decide otherwise."
      titleKey="title"
      subtitleKey="body"
      imageKey="media_url"
      badgeKey="mood"
      metaKeys={['entry_date']}
      fields={fields}
    />
  );
}
