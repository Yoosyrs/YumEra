'use client';

import { ResourceManager, RMField } from '@/components/resource-manager';

const fields: RMField[] = [
  { key: 'name', label: 'Name', placeholder: 'Your yumesona name', required: true },
  { key: 'tagline', label: 'Tagline', placeholder: 'A short line that captures them' },
  { key: 'universe', label: 'Universe', placeholder: 'Where do they live?' },
  { key: 'image_url', label: 'Portrait', type: 'image' },
  { key: 'visibility', label: 'Visibility', type: 'select', options: [
    { value: 'public', label: 'Public' },
    { value: 'followers', label: 'Followers only' },
    { value: 'private', label: 'Only me' },
  ] },
  { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
  { key: 'personality', label: 'Personality', type: 'textarea', rows: 3, full: true },
  { key: 'biography', label: 'Biography', type: 'textarea', rows: 4, full: true },
  { key: 'story', label: 'Story', type: 'textarea', rows: 4, full: true },
  { key: 'relationships', label: 'Relationships', type: 'textarea', rows: 3, full: true },
  { key: 'traits', label: 'Traits', type: 'tags', placeholder: 'gentle, celestial, mischievous' },
  { key: 'gallery', label: 'Gallery image URLs', type: 'tags', placeholder: 'Paste image URLs' },
];

export default function YumesonasPage() {
  return (
    <ResourceManager
      resource="yumesonas"
      title="Yumesona Studio"
      subtitle="Register and manage every version of yourself across your universes."
      singular="yumesona"
      emptyTitle="No yumesonas yet"
      emptyHint="Create your first yumesona: name, portrait, universe and story."
      titleKey="name"
      subtitleKey="tagline"
      imageKey="image_url"
      badgeKey="visibility"
      metaKeys={['universe']}
      fields={fields}
      intro={
        <p className="tiny muted" style={{ margin: 0 }}>
          Each yumesona is a private-to-you draft until you choose a visibility. Public and follower-only
          yumesonas appear on your profile and in Explore.
        </p>
      }
    />
  );
}
