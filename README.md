# Keepsake

One person creates a memory project, shares a link, and everyone contributes voice messages, notes and photos
**without an account**. Contributions are moderated and assembled into a keepsake page.

Languages: English, Français, العربية (RTL), Español.

## Quick start

```bash
cp .env.example .env            # set BETTER_AUTH_SECRET and STORAGE_SIGNING_SECRET (openssl rand -hex 32)
docker compose up -d            # Postgres 16 on :5432 (or use any Postgres 16 you already have)
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
npm run check                   # typecheck + lint + tests
```

Testing on a real phone (needs HTTPS): see [PHONE-TEST.md](PHONE-TEST.md).

## Architecture (decisions)

| Concern | Choice | Why |
|---|---|---|
| App | Next.js 16 App Router, TypeScript, Tailwind v4 | SSR for keepsake/link previews; one codebase |
| i18n | next-intl, locale-prefixed routes, `dir="rtl"` for Arabic | `proxy.ts` picks locale from Accept-Language |
| DB | PostgreSQL + Drizzle | relational data; typed SQL; plain migrations in `drizzle/` |
| Auth | Better Auth (email/password, Google if configured) | organizers only; contributors never authenticate |
| Storage | `STORAGE_DRIVER=local` (dev) or `s3` (Cloudflare R2 / any S3) | media never in Postgres; private, signed URLs |
| Rate limiting | Postgres fixed-window counters | no Redis needed at MVP scale |

### Security model
- Contributors hold a **contribute token** (144-bit, write-only, revocable, optional expiry). The keepsake is
  reached by an unguessable slug (64-bit suffix) plus privacy mode (link / password / private).
- Uploads: signed URL, direct PUT, then on submit the server checks **key ownership** (must be under the
  project's prefix), existence, size, and **magic-byte content type** (extension and declared type are ignored).
  Rejected files are deleted.
- Every organizer query is scoped by `ownerId` in SQL; IDs alone never grant access.
- Edit secrets are stored hashed; passwords use scrypt; the unlock cookie is bound to the stored hash.

## Status
Phase 1 (core MVP) is implemented. Not yet built: cover-photo upload, video contributions, audio processing
(ffmpeg worker), transcription (whisper.cpp worker), email invitations, ZIP export, payments, admin panel.
No CSP header yet (needs nonce plumbing). Payment provider for Tunisia is still to be chosen.

## Notes
- The scaffold's `cacheComponents` / `partialPrefetching` flags are intentionally not enabled; pages render dynamically.
- `npm audit` reports dev-only ESLint-toolchain advisories (braces). `npm audit fix --force` would downgrade Next, so it is not applied.
- `scripts/seed-project.ts <email>` creates a sample project for local testing.

## Themes, stickers, story mode, surprise reveal
- `projects.theme` (6 themes, default per occasion), `projects.reveal_at`, `contributions.sticker` (8 fixed stickers).
- Reveal is enforced on the server: before the date, visitors get no contributions and no media links. The owner can preview.
- "Play all" story player on the keepsake page. `npm run smoke` runs 32 API checks against a running server (`SMOKE_URL`).
- Migration: `npm run db:migrate` (0002_themes_reveal_stickers).

## Emoji and animated reactions
- Emoji picker: `emoji-picker-element` (Apache-2.0), search data self-hosted in `public/emoji-data` (en, fr; Arabic/Spanish use English names).
- Animated reactions: Google Noto animated emoji (CC BY 4.0) from Google's font CDN, stored as `e:<codepoint>` from a fixed allow-list; falls back to the static emoji if the image can't load.
- Media endpoint now supports HTTP Range (needed for audio on iPhone Safari).
