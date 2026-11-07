/**
 * Email delivery.
 *
 * YumEra sends transactional email through an HTTP provider (Resend-compatible).
 * When no provider is configured the API must say so instead of pretending a
 * message was delivered.
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || 'YumEra <noreply@yumera.app>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
    });
    if (!response.ok) {
      console.error('[email] provider rejected the message', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email] send failed', error);
    return false;
  }
}
