import { selectColumns } from '@/lib/selectColumns';

export const CATALOG_PAGE_SIZE = 24;
const CATALOG_COLUMNS = 'id, title, artist_name, cover_url, release_type, created_at, value_tier, is_new_name, is_freshman, reviews(count)';
const SCORE_COLUMNS = ['year', 'score', 'community_score', 'critics_score', 'score_community', 'score_critics'] as const;

export function queryCatalog<T extends { error: { message: string } | null }>(query: (columns: string) => PromiseLike<T>) {
  return selectColumns('releases', CATALOG_COLUMNS, SCORE_COLUMNS, query);
}

