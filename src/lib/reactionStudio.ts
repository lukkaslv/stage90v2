export type ReactionScene = 'intro' | 'tracks' | 'score';
export type ReactionChartType = 'tracks' | 'artists';
export type ReactionOutputScene = 'listen' | 'discussion' | 'tracks' | 'artists';

export const reactionScenes: { id: ReactionOutputScene; state: ReactionScene; label: string; description: string }[] = [
  { id: 'listen', state: 'intro', label: 'მოსმენა', description: 'დიდი ვიდეო და კამერა მარჯვნივ' },
  { id: 'discussion', state: 'score', label: 'განხილვა და შეფასება', description: 'რელიზი, საბოლოო ქულა და ვერტიკალური კამერა' },
  { id: 'tracks', state: 'tracks', label: 'ტოპ-15 ტრეკი', description: 'ტრეკების სრული რეიტინგი და ვერტიკალური კამერა' },
  { id: 'artists', state: 'tracks', label: 'ტოპ-15 არტისტი', description: 'არტისტების სრული რეიტინგი და ვერტიკალური კამერა' },
];

export function reactionSceneFromParam(value: string | null): ReactionOutputScene | undefined {
  return reactionScenes.find((scene) => scene.id === value)?.id;
}

export function reactionSceneFromView(scene: ReactionScene, chartType?: ReactionChartType): ReactionOutputScene {
  if (scene === 'tracks' && chartType === 'artists') return 'artists';
  return reactionScenes.find((entry) => entry.state === scene)?.id ?? 'listen';
}

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
  score: number;
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

export function reactionOutputUrl(token: string, scene?: ReactionOutputScene): string {
  return `${window.location.origin}/studio/obs?token=${encodeURIComponent(token)}${scene ? `&scene=${scene}` : ''}`;
}
