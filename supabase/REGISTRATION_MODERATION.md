# Registration and verification

The registration form creates a Supabase Auth user with a password. The database creates a matching `public.profiles` row with `is_verified = false`, preserving the requested user or author role, social profile URL, and registration reason. If email confirmation is enabled, the user confirms their email before signing in.

An administrator reviews the profile in **Users & verification** and changes `is_verified` to true. Until then, the release page disables score and review submission. A database trigger on `public.reviews` enforces the same rule for both new and updated reviews, including score-only submissions. Administrators can still use the reaction studio.

## Activation

1. Apply `migrations/20261005000004_open_registration_verification.sql` after the earlier migrations, before deploying the new frontend. Without it, the old Auth trigger blocks direct signup.
2. Configure Supabase Auth email confirmation and its Site URL for the deployed site. Test signup, email confirmation (if enabled), sign-in, administrator verification, and score submission with a new account.
3. Existing pending rows in `registration_requests` can still be handled through the legacy applications tab and `moderate-registration` Edge Function. Keep that function, its redirect URL, and mail configuration until those requests are resolved. New registrations do not create application rows.
