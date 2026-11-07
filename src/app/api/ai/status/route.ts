import { ok, route } from '@/lib/api';
import { aiConfig, isAiConfigured } from '@/lib/ai';
import { emailConfigured } from '@/lib/email';

/**
 * Reports which external providers are really configured.
 * The UI uses this to avoid pretending an AI or email provider exists.
 */
export const GET = route(async () => {
  const config = aiConfig();
  return ok({
    ai: {
      configured: isAiConfigured(),
      model: isAiConfigured() ? config.model : null,
      provider: isAiConfigured() ? new URL(config.baseUrl).host : null,
    },
    email: { configured: emailConfigured() },
    spotify: {
      configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    },
    push: { configured: true },
  });
});
