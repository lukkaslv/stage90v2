interface QueryResult { error: { message: string } | null; }
const omittedColumns = new Map<string, Set<string>>();

// Older deployments may omit optional counters or score aliases.
// Only an explicit missing-column error permits retrying a narrower projection.
export async function selectColumns<T extends QueryResult>(table: string, required: string, optional: readonly string[], query: (columns: string) => PromiseLike<T>): Promise<T> {
  const omitted = omittedColumns.get(table) ?? new Set<string>();
  omittedColumns.set(table, omitted);
  const retried = new Set<string>();
  while (true) {
    const columns = [required, ...optional.filter((column) => !omitted.has(column))].join(', ');
    const result = await query(columns);
    if (!result.error) return result;
    const missing = result.error.message.match(/column\s+(?:[\w]+\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
      ?? result.error.message.match(/Could not find the ['"](\w+)['"] column/i)?.[1];
    if (!missing || !optional.includes(missing) || retried.has(missing)) return result;
    retried.add(missing);
    omitted.add(missing);
  }
}
