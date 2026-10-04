# Stage 90 — AI Agents & Developer Protocol

## 1. Project Identity & Architecture
- Platform: "Stage 90" (Georgian music media platform modeled after risazatvorchestvo.com with a 90-point scoring model).
- Frontend: Single-Page Application (SPA) based on Vite, React 18, TypeScript, Tailwind CSS, Lucide React.
- Backend & Data Layer: Supabase (PostgreSQL, Row Level Security, Auth, Realtime). Direct queries via `@supabase/supabase-js` from `@/lib/supabase`.
- State & Loading: React Context (`AuthContext`, `LoadingContext`), inline view routing inside `src/App.tsx`.
- Scoring Formula: `computeRZTScore` in `src/types/music.ts` (4 criteria 1–10 + vibe coefficient 1.0–1.6072, mapped to tiers: ვერცხლი, ოქრო, ზურმუხტი, საფირონი, ლალი).

## 2. Non-Negotiable Operational Rules
- 100% Pure Georgian UI Copy: All end-user interface strings (labels, placeholders, buttons, validation alerts, empty states, modals) MUST be in authentic Georgian (ქართული ენა). Never introduce English or Russian strings in the UI.
- Zero Mock Fallbacks: Never introduce static mock arrays, fake fixtures, or simulated latency (`setTimeout`). Every component binds directly to Supabase tables (`releases`, `reviews`, `profiles`, `author_comments`, `author_picks`, `concerts`, `platform_settings`).
- Strict Quality Gates: Zero TypeScript errors (`tsc --noEmit -p tsconfig.app.json` must pass cleanly) and zero ESLint errors before completing any task.
- Explicit Path Aliases: Always use the `@/` path alias pointing to `src/` (e.g. `@/components/Foo`).

## 3. Roles & Permissions Hierarchy
- Allowed Roles: `'user' | 'author' | 'media' | 'admin'` (stored in `public.profiles.role`).
- Author Categories: `'artist' | 'producer' | 'sound_engineer' | 'designer' | 'videomaker'`.
- Badges: Managed strictly via `@/components/RoleBadge.tsx`. Do not hardcode ad-hoc role pill markup in review or comment cards.
- Media Releases: Media users can submit releases without a monthly quota.
- Admin Scope: Complete CRUD access across releases, reviews, concerts, verification statuses, and maintenance toggles (`platform_settings`).

## 4. Token Preservation Rules (Codex / Trae / Cursor)
- Never print unchanged files.
- Provide minimal, self-contained diffs or exact target component code.
- Do not use placeholders like `// TODO: implement later` or truncate methods.
- Avoid conversational pleasantries, introductory text, and post-explanations.
