interface AuthorOption { id: string; display_name: string | null; email: string | null; role: string; }
interface TrackOption { id: string | number; title: string; artist_name: string | null; cover_url: string | null; }

interface ReleaseRelationshipFieldsProps {
  authors: AuthorOption[];
  authorProfileId: string;
  onAuthorChange: (id: string) => void;
  isBundle: boolean;
  tracks: TrackOption[];
  selectedTrackIds: string[];
  onToggleTrack: (id: string) => void;
  onMoveTrack: (id: string, direction: -1 | 1) => void;
  showAuthor?: boolean;
  showBundle?: boolean;
}

export default function ReleaseRelationshipFields({ authors, authorProfileId, onAuthorChange, isBundle, tracks, selectedTrackIds, onToggleTrack, onMoveTrack, showAuthor = true, showBundle = true }: ReleaseRelationshipFieldsProps) {
  return <>
    {showAuthor && <label className="block text-xs text-gray-400">ავტორის ანგარიში (პროფილი)
      <select value={authorProfileId} onChange={(event) => onAuthorChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[#2a2a32] bg-[#0b0b0e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60">
        <option value="">— აირჩიეთ რეგისტრირებული პროფილი (არასავალდებულო) —</option>
        {authors.map((author) => <option key={author.id} value={author.id}>{author.display_name || 'რეგისტრირებული პროფილი'}{author.email ? ` · ${author.email}` : ''}</option>)}
      </select>
    </label>}
    {showBundle && isBundle && <section className="mt-4 rounded-xl border border-cyan-400/20 bg-[#0b0b0e] p-4 shadow-[0_0_28px_rgba(0,242,254,0.08)]">
      <h3 className="text-sm font-bold text-cyan-200">ალბომში ტრეკების გაერთიანება</h3>
      <p className="mt-1 text-xs text-gray-500">აირჩიეთ აქტიური დამოუკიდებელი ტრეკები და მათი რიგი.</p>
      <div className="mt-3 space-y-2">
        {tracks.length === 0 ? <p className="text-xs text-gray-500">დამოუკიდებელი ტრეკები ვერ მოიძებნა.</p> : tracks.map((track) => {
          const id = String(track.id);
          const position = selectedTrackIds.indexOf(id);
          return <div key={id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:border-cyan-400/40"><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={position >= 0} onChange={() => onToggleTrack(id)} className="accent-cyan-400" />{track.cover_url && <img src={track.cover_url} alt="" className="h-9 w-9 rounded object-cover" />}<span className="truncate">{track.title}<span className="ml-2 text-xs text-gray-500">{track.artist_name || 'უცნობი არტისტი'}</span></span></label>{position >= 0 && <><span className="whitespace-nowrap text-xs font-bold text-cyan-300">#{position + 1}</span><button type="button" disabled={position === 0} onClick={() => onMoveTrack(id, -1)} aria-label="ტრეკის ზემოთ გადატანა" className="text-gray-500 hover:text-cyan-300 disabled:opacity-30">▲</button><button type="button" disabled={position === selectedTrackIds.length - 1} onClick={() => onMoveTrack(id, 1)} aria-label="ტრეკის ქვემოთ გადატანა" className="text-gray-500 hover:text-cyan-300 disabled:opacity-30">▼</button></>}</div>;
        })}
      </div>
    </section>}
  </>;
}

export type { AuthorOption, TrackOption };
