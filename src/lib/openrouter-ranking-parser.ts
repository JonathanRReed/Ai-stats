export type OpenRouterRankingRow = {
  date?: string;
  model_permaslug?: string;
  variant?: string;
  variant_permaslug?: string;
  total_completion_tokens?: number;
  total_prompt_tokens?: number;
  total_native_tokens_reasoning?: number;
  count?: number;
  total_tool_calls?: number;
  requests_with_tool_call_errors?: number;
  change?: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseArrayAt = (text: string, start: number): unknown[] | null => {
  if (text[start] !== '[') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, index + 1)) as unknown;
          return Array.isArray(value) ? value : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};

const rankingRows = (value: unknown): OpenRouterRankingRow[] =>
  Array.isArray(value) ? value.filter((row): row is OpenRouterRankingRow => isRecord(row)) : [];

export const parseOpenRouterRankingRows = (flightText: string): OpenRouterRankingRow[] => {
  const key = '"rankingData":';
  const keyIndex = flightText.indexOf(key);
  if (keyIndex < 0) return [];
  const valueStart = keyIndex + key.length;

  const inline = parseArrayAt(flightText, valueStart);
  if (inline) return rankingRows(inline);

  const reference = /^"\$([0-9a-f]+):([^"]+)"/i.exec(flightText.slice(valueStart));
  if (!reference) return [];
  const [, chunkId, path] = reference;
  const marker = `\n${chunkId}:`;
  const markerIndex = flightText.indexOf(marker);
  const chunkStart = markerIndex >= 0
    ? markerIndex + marker.length
    : flightText.startsWith(`${chunkId}:`) ? chunkId.length + 1 : -1;
  if (chunkStart < 0) return [];

  let value: unknown = parseArrayAt(flightText, chunkStart);
  for (const segment of path.split(':')) {
    if (segment === 'props' && Array.isArray(value) && value[0] === '$') value = value[3];
    else if (Array.isArray(value) && /^\d+$/.test(segment)) value = value[Number(segment)];
    else if (isRecord(value)) value = value[segment];
    else return [];
  }
  return rankingRows(value);
};
