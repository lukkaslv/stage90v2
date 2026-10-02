import { Quote } from 'lucide-react';
import { RZT_PARAMS, type Review } from '@/types/music';
import RoleBadge from '@/components/RoleBadge';

function RatingBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden bg-[#30343e]">
        <div
          className="h-full bg-[#b8becb] transition-all"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-[11px] font-bold text-gray-300">{value}</span>
    </div>
  );
}

export default function ReviewCard({ review }: { review: Review }) {
  const experienceRatings = 'response' in review.ratings ? review.ratings : null;
  const legacyRatings = 'production' in review.ratings ? review.ratings : null;
  return (
    <article className="stage-review-card card-hover min-w-0 max-w-full overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215] p-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <img
          src={review.coverUrl}
          alt={review.releaseTitle}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{review.username}</span>
            <RoleBadge role={review.role} category={review.authorCategory} isVerified={review.isVerified} />
          </div>
          <p className="mt-1 break-words break-all overflow-hidden text-xs text-gray-400">
            <span className="text-gray-300">{review.releaseTitle}</span> — {review.artist}
          </p>
        </div>
        {/* Total score */}
        <div className="shrink-0 text-right">
          <div className="stage-review-score text-2xl font-extrabold leading-none">{review.totalScore}<small>/90</small></div>
          <span className="text-[10px] text-gray-600">ჯამური</span>
        </div>
      </div>

      {/* Rating breakdown */}
      <div className="mt-4 space-y-2">
        {experienceRatings ? (
          [experienceRatings.response, experienceRatings.engagement, experienceRatings.immersion, experienceRatings.transformation].map((value, index) => (
            <RatingBar key={RZT_PARAMS[index].id} label={RZT_PARAMS[index].label} value={value} max={10} />
          ))
        ) : legacyRatings && (
          <>
            <p className="text-[11px] text-gray-500">ძველი ტექნიკური შეფასება</p>
            <RatingBar label="პროდუქცია" value={legacyRatings.production} />
            <RatingBar label="ტექსტი" value={legacyRatings.lyrics} />
            <RatingBar label="ორიგინალობა" value={legacyRatings.originality} />
            <RatingBar label="გამეორება" value={legacyRatings.replay} />
          </>
        )}
      </div>

      {/* Excerpt */}
      <div className="mt-4 relative">
        <Quote className="absolute -top-1 -left-0.5 h-4 w-4 text-gray-700" />
        <p className="break-words break-all overflow-hidden pl-5 text-sm leading-relaxed text-gray-400 line-clamp-3">
          {review.excerpt}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-[#1e1e24] pt-3">
        <span className="text-[11px] text-gray-600">{review.date}</span>
        <button className="text-[11px] font-medium text-blue-400 transition-colors hover:text-blue-300">
          სრული რეცენზია →
        </button>
      </div>
    </article>
  );
}
