export const CATALOG_PAGE_SIZE = 24;

export function queryCatalog<T extends { error: { message: string } | null }>(query: (columns: string) => PromiseLike<T>) {
  return query('*, reviews(count)');
}

