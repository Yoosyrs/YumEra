/**
 * AI provider integration.
 *
 * YumEra talks to any OpenAI-compatible chat completion endpoint. Keys stay on
 * the server: they are read from the environment and never sent to the browser.
 * When no provider is configured the UI must say so explicitly instead of
 * pretending a model answered.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function aiConfig(): AiConfig {
  return {
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  };
}

export function isAiConfigured(): boolean {
  return aiConfig().apiKey.length > 8;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI provider is not configured');
  }
}

export async function aiComplete(messages: AiMessage[], options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const config = aiConfig();
  if (!isAiConfigured()) throw new AiNotConfiguredError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.85,
        max_tokens: options.maxTokens ?? 700,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI provider error ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI provider returned an empty response');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export function characterSystemPrompt(character: {
  name: string;
  personality: string;
  biography: string;
  universe: string;
  story: string;
  speech_style: string;
  behavior_rules: string;
}): string {
  return [
    `You are roleplaying as "${character.name}", a fictional character inside YumEra.`,
    character.universe && `Universe: ${character.universe}`,
    character.biography && `Biography: ${character.biography}`,
    character.story && `Backstory: ${character.story}`,
    character.personality && `Personality: ${character.personality}`,
    character.speech_style && `Speech style: ${character.speech_style}`,
    character.behavior_rules && `Behaviour rules: ${character.behavior_rules}`,
    'Stay in character. Never claim to be an AI language model. Never send mass messages.',
    'Keep replies under 180 words unless the user asks for more.',
    'Refuse harassment, sexual content involving minors, and any request to contact other users.',
  ]
    .filter(Boolean)
    .join('\n');
}
