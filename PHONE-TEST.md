# Testing Keepsake on a real phone

Phones only allow microphone access over **HTTPS**, so we expose the app through a free Cloudflare Tunnel.
Use **production mode** (`build` + `start`), not `npm run dev`: dev mode blocks requests from unknown hostnames.

## 1. Install once
- Node.js 22 (https://nodejs.org)
- Docker Desktop (for the database) — or any PostgreSQL 16
- cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
- ffmpeg is NOT needed yet (audio processing arrives in Phase 2)

## 2. Set up
```bash
unzip keepsake.zip && cd keepsake
docker compose up -d                 # starts Postgres on :5432
cp .env.example .env
npm install
```
Edit `.env` and set the two secrets to long random strings (any 32+ characters; `openssl rand -hex 32` works).

## 3. Start the tunnel FIRST (its address is random and goes into .env)
In a separate terminal:
```bash
cloudflared tunnel --url http://localhost:3000
```
It prints an address like `https://something-random.trycloudflare.com`. Copy it, then in `.env` set:
```
APP_URL=https://something-random.trycloudflare.com
BETTER_AUTH_URL=https://something-random.trycloudflare.com
```
(The address changes every time you restart the tunnel, so update `.env` and rebuild if you do.)

## 4. Build and run
```bash
npm run db:migrate
npm run build
npm run start
```

## 5. Test on your phone
Open the tunnel address on your phone, create an account, and create a memory. Copy the contribution link from the
project page and open it on a **second** device (or a private tab) to behave like a contributor.

Checklist — please try on both iPhone (Safari) and Android (Chrome):
1. Record ~30 seconds, pause, resume, stop, replay, submit.
2. Deny the microphone permission once and confirm the message and the "Upload an audio file" fallback appear.
3. Send the contribution link in WhatsApp, tap it, and see whether recording works inside WhatsApp's browser.
   (If not, the "open in Safari/Chrome" notice should show.)
4. Add a photo straight from the camera.
5. Write a message using one of the suggested questions.
6. Approve everything on the project page, then open "Preview the keepsake" and play the audio.
7. Switch the language (English / Français / العربية / Español) on each page.

Please note anything that fails, the phone model, OS version and browser, and whether you saw an error message.

## 6. New in this version: themes, stickers, story mode, surprise date
After `git`/files update, run once: `npm run db:migrate` (adds the new columns), then `npm run build` and `npm run start`.
Optional automatic check of the whole API (creates and deletes its own test data): `npm run smoke`.

Try on your phone:
1. Create a memory: on step 3 pick a theme (Sidi, Jasmine, Sunrise, Night, Olive, Gold) and, optionally, a surprise date.
2. Open the contributor link: the page uses the theme, with floating shapes. Pick a sticker, send a note.
3. Approve it, open the keepsake, tap "Play all": voices, notes and photos play one after another.
4. Set a surprise date a few minutes ahead (project page, "Look and reveal"). Open the keepsake in a private tab: it
   shows a countdown. You (signed in) still see it with a "sealed" banner. At zero it opens by itself.
