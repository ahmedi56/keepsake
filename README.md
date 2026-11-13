# Keepsake

<p align="center">
  <strong>Every memory deserves to be shared.</strong>
  <br />
  One link. Everyone contributes. Memories that last forever.
</p>

<p align="center">
  A collaborative memory-sharing platform where people collect photos, voice messages, and personal notes through a single shared link  without requiring contributors to create an account.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-316192?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## Overview

Keepsake makes it easy to bring people together around meaningful moments.

Create a memory project, share its link, and invite friends, family, or colleagues to contribute. Every contribution becomes part of a personalized digital keepsake that can be shared and revisited.

Designed for celebrations, milestones, appreciation, and the moments worth remembering.

## Features

- **Account-free contributions** : Contributors can participate without registering.
- **Multiple contribution types** : Collect photos, voice messages, and written notes.
- **Content moderation** : Review and approve contributions before publication.
- **Privacy controls** : Choose link-based, password-protected, or private access.
- **Scheduled reveals** : Keep contributions hidden until a special date.
- **Personalization** : Six themes, stickers, and animated reactions.
- **Story mode** : Experience collected memories through a dedicated player.
- **Internationalization** : English, French, Arabic (RTL), and Spanish.

## Use Cases

| Occasion | Purpose |
|---|---|
| Birthdays | Collect wishes and memorable moments |
| Weddings | Create a shared collection of memories |
| Graduations | Preserve messages from friends and classmates |
| Farewells | Give colleagues a meaningful digital gift |
| Anniversaries | Celebrate shared experiences |
| Team appreciation | Bring messages of gratitude together |

## Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI & Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Authentication | Better Auth |
| Internationalization | next-intl |
| Media Storage | Local Storage / S3-compatible storage |
| Object Storage | Cloudflare R2 or compatible providers |

## Getting Started

### Prerequisites

- Node.js
- npm
- Docker
- PostgreSQL 16 (or Docker Compose)

### Installation

```bash
# Clone the repository
git clone https://github.com/ahmedi56/keepsake.git

# Navigate to the project
cd keepsake

# Create environment configuration
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Configuration

Configure the required secrets in `.env`:

- `BETTER_AUTH_SECRET`
- `STORAGE_SIGNING_SECRET`

Generate secure values with:

```bash
openssl rand -hex 32
```

Refer to `.env.example` for the remaining configuration options.

## Development

Run type checking, linting, and tests:

```bash
npm run check
```

Run API smoke tests against a running server:

```bash
npm run smoke
```

Configure `SMOKE_URL` when testing a server running at a non-default address.

## Architecture & Security

Keepsake is built around a privacy-conscious architecture:

- Organizers authenticate using Better Auth.
- Contributors use revocable, scoped contribution tokens.
- Media files are stored outside the relational database.
- Uploads are validated server-side, including file ownership, size, existence, and magic-byte content type.
- Private media is accessed through signed URLs.
- Organizer database queries are scoped by ownership.
- Passwords and editing secrets are securely hashed.
- Scheduled reveals are enforced server-side.

## Project Status

**Phase 1 — Core MVP implemented.**

The core platform is implemented. Additional capabilities are planned:

- Video contributions
- Audio processing and transcription
- Email invitations
- ZIP exports
- Payments
- Administration panel

## Supported Languages

- English
- Français
- العربية (RTL)
- Español

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Keepsake</strong>
  <br />
  Turning shared moments into lasting memories.
</p>
