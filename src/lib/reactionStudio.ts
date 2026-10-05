export type ReactionScene = 'intro' | 'tracks' | 'score';
export type ReactionChartType = 'tracks' | 'artists';

export interface ReactionRelease {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string | null;
  youtube_url?: string | null;
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
  youtube_url?: string | null;
}

export interface ReactionComment {
  author: string | null;
  text: string | null;
  visible: boolean;
}

export interface ReactionView {
  id: string;
  scene: ReactionScene;
  chart_type: ReactionChartType;
  track_id: string | null;
  params: number[];
  vibe: number;
  revealed: boolean;
  comment?: ReactionComment;
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

export function reactionCommentInitial(author: string): string {
  return Array.from(author.trim().replace(/^@/, ''))[0]?.toLocaleUpperCase() ?? '•';
}

export function reactionOutputUrl(token: string): string {
  return `${window.location.origin}/studio/obs?token=${encodeURIComponent(token)}`;
}
