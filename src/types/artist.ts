export const ARTIST_SOCIALS = [
  { key: 'instagram', label: 'ინსტაგრამი' },
  { key: 'youtube', label: 'იუთუბი' },
  { key: 'spotify', label: 'სპოტიფაი' },
  { key: 'facebook', label: 'ფეისბუქი' },
  { key: 'tiktok', label: 'ტიკტოკი' },
  { key: 'soundcloud', label: 'საუნდქლაუდი' },
  { key: 'website', label: 'ვებგვერდი' },
] as const;

export type ArtistSocialKey = typeof ARTIST_SOCIALS[number]['key'];
export interface Artist {
  id: string;
  name: string;
  photo_url: string;
  bio: string;
  social_links: Partial<Record<ArtistSocialKey, string>>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RankedArtist extends Omit<Artist, 'is_active' | 'updated_at'> {
  rank: number | null;
  total_score: number;
  average_score: number;
  rated_track_count: number;
  track_count: number;
  release_count: number;
  tracks_60_plus: number;
  tracks_70_plus: number;
}

export interface ArtistRelease {
  artist_id: string;
  artist_display_name: string;
  artist_photo_url: string;
  release_id: string | number;
  title: string;
  artist_name: string;
  cover_url: string | null;
  release_type: string;
  parent_id: string | null;
  track_number: number | null;
  created_at: string;
  overall_score: number;
  preliminary_score: number;
  eligible_voter_count: number;
  is_scoring_track: boolean;
  score_counted: boolean;
}
