import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { Shell } from '@/components/shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/');
  return (
    <Shell
      user={{
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      }}
    >
      {children}
    </Shell>
  );
}
