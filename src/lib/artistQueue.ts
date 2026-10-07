export interface ArtistQueueEntry {
  artist: string;
  requests: number;
}

export function getQueue(source: string | null): ArtistQueueEntry[] {
  if (!source) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry): entry is ArtistQueueEntry =>
      entry !== null && typeof entry === 'object'
      && typeof entry.artist === 'string' && entry.artist.trim().length > 0
      && typeof entry.requests === 'number' && Number.isInteger(entry.requests) && entry.requests > 0)
    .map((entry) => ({ artist: entry.artist.trim(), requests: entry.requests }))
    .sort((a, b) => b.requests - a.requests || a.artist.localeCompare(b.artist, 'ka'));
}
