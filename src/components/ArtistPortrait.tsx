import { useState } from 'react';
import { Mic2 } from 'lucide-react';
import { safeArtistUrl } from '@/lib/artistRank';

export default function ArtistPortrait({ src, className = '' }: { src?: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = safeArtistUrl(src);
  return <span className={`stage-artist-portrait ${className}`}>
    {url && failedUrl !== url
      ? <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} />
      : <Mic2 aria-hidden="true" className="h-2/5 w-2/5 opacity-60" />}
  </span>;
}
