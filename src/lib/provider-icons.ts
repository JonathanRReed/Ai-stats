/** One lookup for lab marks, shared by charts, pickers and model pages. */
export type ProviderIcon = { src: string; mono: boolean };

const icon = (file: string, mono = false): ProviderIcon => ({ src: `/icons/providers/${file}.svg`, mono });

// Single-ink marks are drawn in black and need inverting on dark surfaces.
const ICONS: Record<string, ProviderIcon> = {
  openai: icon('openai', true),
  anthropic: icon('anthropic', true),
  google: icon('google'),
  meta: icon('meta'),
  mistral: icon('mistral'),
  cohere: icon('cohere-color'),
  deepseek: icon('deepseek-color'),
  alibaba: icon('qwen-color'),
  xai: icon('xai', true),
  nvidia: icon('nvidia-color'),
  microsoft: icon('microsoft'),
  moonshot: icon('moonshot', true),
  perplexity: icon('perplexity'),
  bytedance: icon('bytedance'),
  minimax: icon('minimax'),
  zai: icon('zai', true),
};

const PROVIDER_PATTERNS: Array<[RegExp, keyof typeof ICONS]> = [
  [/open\s*ai/i, 'openai'], [/anthropic/i, 'anthropic'], [/google|deepmind/i, 'google'], [/^meta\b|meta ai/i, 'meta'],
  [/mistral/i, 'mistral'], [/cohere/i, 'cohere'], [/deepseek/i, 'deepseek'], [/alibaba|qwen/i, 'alibaba'],
  [/\bx\.?ai\b|spacexai/i, 'xai'], [/nvidia/i, 'nvidia'], [/microsoft/i, 'microsoft'], [/moonshot|^kimi\b/i, 'moonshot'],
  [/perplexity/i, 'perplexity'], [/bytedance/i, 'bytedance'], [/minimax/i, 'minimax'], [/zhipu|\bz\.?\s?ai\b/i, 'zai'],
];

const FAMILY_PATTERNS: Array<[RegExp, keyof typeof ICONS]> = [
  [/^(gpt|o[1-9]\b|chatgpt)/i, 'openai'], [/^claude/i, 'anthropic'], [/^(gemini|gemma)/i, 'google'], [/^(llama|muse)/i, 'meta'],
  [/^(mistral|codestral|pixtral|ministral)/i, 'mistral'], [/^command/i, 'cohere'], [/^deepseek/i, 'deepseek'], [/^qwen/i, 'alibaba'],
  [/^grok/i, 'xai'], [/^kimi/i, 'moonshot'], [/^sonar/i, 'perplexity'], [/^(doubao|seed)/i, 'bytedance'], [/^minimax/i, 'minimax'], [/^glm/i, 'zai'],
];

/** The lab mark for a provider, falling back to the family name; null when no mark is on file. */
export function providerIcon(provider?: string | null, family?: string | null): ProviderIcon | null {
  const byProvider = provider ? PROVIDER_PATTERNS.find(([pattern]) => pattern.test(provider)) : undefined;
  const match = byProvider ?? (family ? FAMILY_PATTERNS.find(([pattern]) => pattern.test(family)) : undefined);
  return match ? ICONS[match[1]] : null;
}
