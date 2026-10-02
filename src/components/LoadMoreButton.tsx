export default function LoadMoreButton({ loading, hasMore, error, onClick }: {
  loading: boolean; hasMore: boolean; error: boolean; onClick: () => void;
}) {
  if (!loading && !hasMore && !error) return null;
  return <div className="mt-4 flex flex-col items-center gap-2">
    {error && <p role="alert" className="text-sm text-rose-300">მონაცემების ჩატვირთვა ვერ მოხერხდა.</p>}
    <button type="button" onClick={onClick} disabled={loading} className="rounded-lg border border-[#2a2a32] px-4 py-2 text-sm font-medium text-gray-300 hover:border-blue-400/40 hover:text-blue-300 disabled:cursor-wait disabled:opacity-50">
      {loading ? 'იტვირთება…' : error ? 'ხელახლა ცდა' : 'მეტის ჩატვირთვა'}
    </button>
  </div>;
}
