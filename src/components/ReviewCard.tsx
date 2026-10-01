import { Quote } from 'lucide-react';
import type { Review } from '@/types/music';
import RoleBadge from '@/components/RoleBadge';

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1e1e24]">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 90 ? 'bg-cyan-400' : value >= 80 ? 'bg-violet-400' : 'bg-gray-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-[11px] font-bold text-gray-300">{value}</span>
    </div>
  );
}

export default function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="card-hover min-w-0 max-w-full overflow-hidden rounded-xl border border-[#1e1e24] bg-[#121215] p-5">
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
          <div
            className={`text-2xl font-extrabold leading-none ${
              review.totalScore >= 90 ? 'text-cyan-400' : review.totalScore >= 80 ? 'text-violet-400' : 'text-gray-300'
            }`}
          >
            {review.totalScore}
          </div>
          <span className="text-[10px] text-gray-600">ჯამური</span>
        </div>
      </div>

      {/* Rating breakdown */}
      <div className="mt-4 space-y-2">
        <RatingBar label="პროდუქცია" value={review.ratings.production} />
        <RatingBar label="ტექსტი" value={review.ratings.lyrics} />
        <RatingBar label="ორიგინალობა" value={review.ratings.originality} />
        <RatingBar label="გამეორება" value={review.ratings.replay} />
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
        <button className="text-[11px] font-medium text-cyan-400 transition-colors hover:text-cyan-300">
          სრული რეცენზია →
        </button>
      </div>
    </article>
  );
}
