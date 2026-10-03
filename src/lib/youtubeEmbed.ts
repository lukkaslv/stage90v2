export function youtubeEmbedUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0] : ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
      ? (parts[0] === 'watch' ? url.searchParams.get('v') : ['live', 'embed', 'shorts'].includes(parts[0]) ? parts[1] : null)
      : null;
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch { return null; }
}
