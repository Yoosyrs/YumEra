'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { ResourceManager, RMField } from '@/components/resource-manager';

interface Option {
  id: string;
  name: string;
}

export default function MemoriesPage() {
  const [yumesonas, setYumesonas] = useState<Option[]>([]);
  const [fos, setFos] = useState<Option[]>([]);

  useEffect(() => {
    api<{ items: Option[] }>('/api/yumesonas').then((d) => setYumesonas(d.items ?? [])).catch(() => {});
    api<{ items: Option[] }>('/api/fos').then((d) => setFos(d.items ?? [])).catch(() => {});
  }, []);

  const fields = useMemo<RMField[]>(() => [
    { key: 'title', label: 'Title', required: true, placeholder: 'Our first night under the stars' },
    { key: 'happened_on', label: 'Date', type: 'date' },
    { key: 'memory_type', label: 'Type', type: 'select', options: [
      { value: 'memory', label: 'Memory' },
      { value: 'anniversary', label: 'Anniversary' },
      { value: 'letter', label: 'Letter' },
      { value: 'photo', label: 'Photo' },
      { value: 'video', label: 'Video' },
    ] },
    { key: 'character_name', label: 'Character', placeholder: 'Free text character name' },
    { key: 'yumesona_id', label: 'Yumesona', type: 'select', options: [
      { value: '', label: '— none —' },
      ...yumesonas.map((entry) => ({ value: entry.id, label: entry.name })),
    ] },
    { key: 'fo_id', label: 'F/O', type: 'select', options: [
      { value: '', label: '— none —' },
      ...fos.map((entry) => ({ value: entry.id, label: entry.name })),
    ] },
    { key: 'media_url', label: 'Photo / video', type: 'image', full: true },
    { key: 'description', label: 'The memory', type: 'textarea', rows: 5, full: true },
  ], [yumesonas, fos]);

  return (
    <ResourceManager
      resource="memories"
      title="Yume Memories"
      subtitle="Private album of moments, letters, anniversaries and dates."
      singular="memory"
      emptyTitle="No memories saved"
      emptyHint="Save a date, a letter or a photo with the character it belongs to."
      titleKey="title"
      subtitleKey="description"
      imageKey="media_url"
      badgeKey="memory_type"
      metaKeys={['happened_on', 'character_name']}
      fields={fields}
      intro={
        <p className="tiny muted" style={{ margin: 0 }}>
          Memories are private to your account. Nothing here is published to the feed.
        </p>
      }
    />
  );
}
