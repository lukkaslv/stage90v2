export type ReactionScene = 'intro' | 'tracks' | 'score';

export interface ReactionRelease {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string | null;
  release_type: string | null;
  overall_score: number | null;
  community_score: number | null;
  critics_score: number | null;
}

export interface ReactionTrack {
  id: string;
  title: string;
  artist_name: string;
  track_number: number | null;
}

export interface ReactionView {
  id: string;
  scene: ReactionScene;
  track_id: string | null;
  params: number[];
  vibe: number;
  revealed: boolean;
  expires_at: string;
  release: ReactionRelease;
  tracks: ReactionTrack[];
}

export interface ReactionSession {
  id: string;
  token: string;
  expires_at: string;
}

export const reactionStorageKey = 'stage90-reaction-session';

export function reactionOutputUrl(token: string): string {
  return `${window.location.origin}/studio/obs#${encodeURIComponent(token)}`;
}
