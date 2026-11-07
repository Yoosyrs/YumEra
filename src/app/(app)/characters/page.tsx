'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'name', label: 'Character name', required: true },
  { key: 'universe', label: 'Universe', placeholder: 'Where they come from' },
  { key: 'avatar_url', label: 'Avatar', type: 'image' },
  { key: 'model', label: 'Model preference', placeholder: 'Leave empty for the server default' },
  { key: 'temperature', label: 'Temperature', type: 'number', hint: '0.1 = precise, 1.2 = expressive' },
  { key: 'visibility', label: 'Visibility', type: 'select', options: [
    { value: 'private', label: 'Only me' },
    { value: 'public', label: 'Public' },
  ] },
  { key: 'personality', label: 'Personality', type: 'textarea', rows: 3, full: true },
  { key: 'biography', label: 'Biography', type: 'textarea', rows: 3, full: true },
  { key: 'story', label: 'History', type: 'textarea', rows: 3, full: true },
  { key: 'speech_style', label: 'Way of speaking', type: 'textarea', rows: 2, full: true, placeholder: 'Formal, archaic, uses pet names…' },
  { key: 'behavior_rules', label: 'Behaviour instructions', type: 'textarea', rows: 3, full: true },
  { key: 'greeting', label: 'Opening line', type: 'textarea', rows: 2, full: true },
];

export default function CharactersPage() {
  return (
    <ResourceManager
      resource="characters"
      title="Character World"
      subtitle="Create original characters and talk with them."
      singular="character"
      emptyTitle="No characters yet"
      emptyHint="Create a character with a personality and speech style, then open it to chat."
      titleKey="name"
      subtitleKey="universe"
      imageKey="avatar_url"
      badgeKey="visibility"
      detailBase="/characters"
      fields={fields}
      intro={
        <p className="tiny muted" style={{ margin: 0 }}>
          Conversations require an AI provider configured on the server. If it is missing, the chat tells you
          instead of pretending to answer.
        </p>
      }
    />
  );
}
