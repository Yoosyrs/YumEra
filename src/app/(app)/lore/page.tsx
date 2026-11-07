'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'title', label: 'Title', required: true, placeholder: 'The Fall of the Silver Court' },
  { key: 'category', label: 'Category', type: 'select', options: [
    { value: 'world', label: 'World' },
    { value: 'character', label: 'Character' },
    { value: 'relationship', label: 'Relationship' },
    { value: 'event', label: 'Event' },
    { value: 'magic', label: 'Magic / rules' },
    { value: 'other', label: 'Other' },
  ] },
  { key: 'visibility', label: 'Visibility', type: 'select', options: [
    { value: 'public', label: 'Public' },
    { value: 'followers', label: 'Followers only' },
    { value: 'private', label: 'Only me' },
  ] },
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'angels, court, tragedy' },
  { key: 'body', label: 'Lore', type: 'textarea', rows: 10, full: true, placeholder: 'Write the lore of your yume…' },
];

export default function LorePage() {
  return (
    <ResourceManager
      resource="lore"
      title="Yume Lore"
      subtitle="The canon of your universe: worlds, rules, characters and events."
      singular="lore entry"
      emptyTitle="No lore written yet"
      emptyHint="Start with the world your yume lives in, then add characters and events."
      titleKey="title"
      subtitleKey="category"
      badgeKey="visibility"
      fields={fields}
    />
  );
}
