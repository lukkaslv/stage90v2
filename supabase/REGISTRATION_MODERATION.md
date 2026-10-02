# Registration moderation setup

The registration form now inserts a request into `public.registration_requests`. It does not call Supabase Auth signup. An administrator approves or rejects each request in the dashboard. Approval invokes the `moderate-registration` Edge Function, which creates and emails an invitation. The invitee sets a password after opening that link.

To activate this flow in the Supabase project:

1. Apply `migrations/20261002000002_registration_moderation.sql` and `migrations/20261002000003_release_score_aggregates.sql` to the project database in order. The first migration creates the request table and blocks direct Auth signups without an approved invitation. It also demotes existing unverified author profiles to regular users for administrator review. The second recalculates stored release scores and keeps them current when reviews change or are deleted.
2. Deploy the `moderate-registration` Edge Function with JWT verification enabled.
3. Set the Edge Function secret `STAGE90_SITE_URL` to the public site origin, for example `https://your-site.example`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side; it is supplied to hosted Edge Functions by Supabase.
4. Add `https://your-site.example/?stage90_invite=1` to Supabase Auth's allowed redirect URLs and configure the Invite user email template and mail delivery.
5. Review any Auth users created before this migration without a corresponding profile. They are not treated as logged-in Stage 90 users by the updated application, but their old Auth records remain until an administrator removes them in Supabase Auth.

Apply both database migrations before deploying the frontend. Without them, requests cannot be stored and scores will not be recalculated; without the Edge Function and email configuration, administrators cannot complete approval.
