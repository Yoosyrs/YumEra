import { ApiError, ok, readJson, route, str } from '@/lib/api';
import { createSession, verifyPassword } from '@/lib/auth';
import { ensurePreferences } from '@/lib/notifications';
import { get } from '@/lib/db';

interface Row {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
}

export const POST = route(async (req) => {
  const body = await readJson(req);
  const identifier = str(body.identifier, 'identifier', { min: 3, max: 200 }).toLowerCase();
  const password = str(body.password, 'password', { min: 1, max: 200 });

  const user = get<Row>(
    'SELECT id, username, display_name, password_hash FROM users WHERE lower(email) = ? OR username = ?',
    identifier,
    identifier,
  );
  // Same generic error for unknown account and wrong password.
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new ApiError(401, 'Incorrect credentials.');
  }

  ensurePreferences(user.id);
  await createSession(user.id, req.headers.get('user-agent') ?? '');
  return ok({ user: { id: user.id, username: user.username, displayName: user.display_name } });
});
