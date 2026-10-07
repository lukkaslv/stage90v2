# Artist profiles and live rankings

Migrations: `migrations/20261005000005_artist_profiles.sql`, then
`migrations/20261005000006_artist_average_ranking.sql`, then
`migrations/20261007000002_artist_three_track_ranking.sql`.

Apply these migrations in order before publishing the frontend. The first extends the existing `artists`
directory, retaining IDs, slugs, image URLs and other legacy fields/relations. Existing
HTTPS image URLs are copied to `photo_url`; new slugs default to a generated unique ID.
Do not replay unrelated historical migrations to install this feature.

## Administration

The **არტისტები** tab in the admin panel creates/edits profiles, portraits (upload or
HTTPS URL), biography, social links, visibility and release associations. Artist
identities do not require authentication accounts. Saving metadata and associations
uses a single admin-only transaction. Concurrent edits are rejected instead of
overwriting a newer version. Public portraits accept JPEG/PNG/WebP up to 5 MiB.

Explicit release links live in `artist_releases`. Linking an album includes its active
child tracks automatically, including children added later. Unlinking the album
removes those inherited associations; any explicitly linked tracks remain. A release
may belong to multiple artists. Removing an artist removes associations, not releases.

## Ranking rules

- Only active profiles and active releases participate.
- Average each distinct scored track's current `overall_score` once per artist.
- Album/EP/mixtape containers and releases with children add no separate points.
- Unrated tracks do not affect the average or receive release tier badges.
- Collaborations contribute their full track score once to each linked artist.
- Profiles with fewer than three scored tracks are listed in the directory with no rank/status.
- Sort by the exact average descending, scored track count descending, profile creation
  time ascending, then ID ascending for deterministic ties. Show the first 15 in the chart.
- Status follows rank: 1 legend, 2–3 superstar, 4–7 star, 8–11 rising, 12+ spark.
- The total remains available as a profile statistic; the average is shown on a
  90-point scale and rounded to one decimal only for display.

`artist_release_catalog` and `artist_rankings` are security-invoker views calculated
from current data. Realtime publication includes `artists`, `artist_releases` and
`releases`. Existing review triggers update `releases.overall_score`; clients reload
the views on those events, on reconnect/visibility changes, and every 60 seconds as
a recovery mechanism. The live indicator appears only while subscribed successfully.

Public routes are `/artists` and `/artists/<uuid>`. The artists maintenance toggle
also hides the homepage preview. Rank badges have independent colors/icons from
release tiers and account role badges.

## Verification

`npm test` executes the actual migration in disposable PostgreSQL (PGlite), covering
UUID/bigint release IDs, legacy artists compatibility, deduplication, score changes,
the three-track threshold and average ordering, unrated/hidden records, cascading links,
atomic validation, concurrent edits, public
visibility and admin-only mutation/storage policies. No test records enter Supabase.

After applying, verify with real editorial profiles: upload a photo, link an album
and one of its tracks, open the profile, then change a track score in another session.
The average should include that track once and update the rank/status without reloading.
