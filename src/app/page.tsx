import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { Landing } from './landing';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/feed');
  return <Landing />;
}
