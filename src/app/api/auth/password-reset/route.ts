import { ApiError, ok, readJson, route, str } from '@/lib/api';
import { hashPassword, randomToken, sha256 } from '@/lib/auth';
import { get, now, run, uid } from '@/lib/db';
import { emailConfigured, sendEmail } from '@/lib/email';

/**
 * POST  — request a reset token.
 * PUT   — consume the token and set a new password.
 *
 * Delivery requires a configured email provider. Without one the endpoint
 * answers honestly (503) instead of leaking a token to anyone who knows an
 * address.
 */
export const POST = route(async (req) => {
  const body = await readJson(req);
  const email = str(body.email, 'email', { min: 5, max: 200 }).toLowerCase();
  const user = get<{ id: string; email: string; display_name: string }>(
    'SELECT id, email, display_name FROM users WHERE lower(email) = ?',
    email,
  );

  // Always answer the same way so the endpoint cannot enumerate accounts.
  const generic = {
    ok: true,
    message: 'If that address belongs to a YumEra account, a reset link has been prepared.',
  };

  if (!user) return ok(generic);
  if (!emailConfigured()) {
    throw new ApiError(
      503,
      'Password reset email delivery is not configured on this deployment (missing RESEND_API_KEY). While signed in you can change your password from Settings → Account.',
    );
  }

  const token = randomToken();
  run(
    'INSERT INTO tokens (id, user_id, kind, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    uid(),
    user.id,
    'password_reset',
    sha256(token),
    new Date(Date.now() + 3600_000).toISOString(),
    now(),
  );
  const base = process.env.APP_URL || '';
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: user.email,
    subject: 'YumEra — reset your password',
    html: `<p>Hello ${user.display_name},</p><p>Use this link within one hour to set a new password:</p><p><a href="${link}">${link}</a></p>`,
  });
  if (!sent) throw new ApiError(502, 'The email provider rejected the message. Try again later.');
  return ok(generic);
});

export const PUT = route(async (req) => {
  const body = await readJson(req);
  const token = str(body.token, 'token', { min: 10, max: 200 });
  const password = str(body.password, 'password', { min: 8, max: 200 });

  const row = get<{ id: string; user_id: string; expires_at: string; used: number }>(
    'SELECT id, user_id, expires_at, used FROM tokens WHERE token_hash = ? AND kind = ?',
    sha256(token),
    'password_reset',
  );
  if (!row || row.used) throw new ApiError(400, 'This reset link is invalid or already used.');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new ApiError(400, 'This reset link has expired.');

  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), row.user_id);
  run('UPDATE tokens SET used = 1 WHERE id = ?', row.id);
  run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
  return ok({ updated: true });
});
