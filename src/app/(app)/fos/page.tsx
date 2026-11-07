'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { ResourceManager, RMField } from '@/components/resource-manager';

interface Yumesona {
  id: string;
  name: string;
}

export default function FoRegistryPage() {
  const [yumesonas, setYumesonas] = useState<Yumesona[]>([]);

  useEffect(() => {
    api<{ items: Yumesona[] }>('/api/yumesonas')
      .then((data) => setYumesonas(data.items ?? []))
      .catch(() => setYumesonas([]));
  }, []);

  const fields = useMemo<RMField[]>(() => {
    const yumeOptions = [
      { value: '', label: '— none —' },
      ...yumesonas.map((entry) => ({ value: entry.id, label: entry.name })),
    ];
    return [
      { key: 'name', label: 'Character name', placeholder: 'Fictional character', required: true },
      { key: 'source_work', label: 'Source work', placeholder: 'Series, game, novel…' },
      { key: 'portrait_url', label: 'Portrait', type: 'image' },
      { key: 'yumesona_id', label: 'Linked yumesona', type: 'select', options: yumeOptions },
      { key: 'relationship_type', label: 'Relationship type', type: 'select', options: [
        { value: 'romantic', label: 'Romantic' },
        { value: 'platonic', label: 'Platonic' },
        { value: 'familial', label: 'Familial' },
        { value: 'rival', label: 'Rival' },
        { value: 'complicated', label: 'Complicated' },
      ] },
      { key: 'visibility', label: 'Visibility', type: 'select', options: [
        { value: 'public', label: 'Public' },
        { value: 'followers', label: 'Followers only' },
        { value: 'private', label: 'Only me' },
      ] },
      { key: 'anti_double', label: 'Anti-Double protection', type: 'select', options: [
        { value: '1', label: 'On — hide from non-approved users' },
        { value: '0', label: 'Off' },
      ], hint: 'Controls visibility and preferences inside YumEra. It cannot stop other people from having their own independent interest in the same character.' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
      { key: 'preferences', label: 'Preferences', type: 'textarea', rows: 3, full: true },
      { key: 'anti_double_notes', label: 'Anti-Double notes', type: 'textarea', rows: 3, full: true, placeholder: 'What should other users know before interacting?' },
    ];
  }, [yumesonas]);

  return (
    <ResourceManager
      resource="fos"
      title="F/O Registry"
      subtitle="A personal registry of the fictional characters you love."
      singular="F/O entry"
      emptyTitle="Your registry is empty"
      emptyHint="Add your first F/O with a portrait, source work and relationship type."
      titleKey="name"
      subtitleKey="source_work"
      imageKey="portrait_url"
      badgeKey="relationship_type"
      metaKeys={['visibility']}
      fields={fields}
      intro={
        <p className="tiny muted" style={{ margin: 0 }}>
          Anti-Double protection is a YumEra visibility control: it hides your entry and preferences from
          users you have not approved. It is not a claim over the character itself.
        </p>
      }
    />
  );
}
