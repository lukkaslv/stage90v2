# Rating quorum and moderation

Apply `migrations/20261009000000_rating_quorum_moderation.sql` before publishing the matching frontend.

- A release keeps a preliminary average after one or two distinct verified voters. Its public `overall_score` remains zero until three distinct verified voters have rated it. Admin votes count as verified.
- The same official score feeds release charts, artist averages, artist statuses, and value tiers. An artist still needs three qualifying tracks.
- The latest eligible review from each user counts once. Excluded votes and votes from unverified profiles do not count. Verification changes recalculate affected releases.
- The admin review table can exclude or restore a score with a required reason. The review remains intact; each moderation action is recorded in `review_score_moderation`.
- Weekly charts use the same verified and moderation filters and still require three votes within seven days.

Run `npm test`, `npm run typecheck`, and `npm run lint` before publishing.
