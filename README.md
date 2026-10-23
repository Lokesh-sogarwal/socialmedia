# Socio

A full-stack social network: posts with photos and video, stories, reels, comments, likes, follows (with private accounts), real-time direct messages, notifications, search, hashtags, reporting and moderation.

| Layer | Stack |
|---|---|
| Web app | React 19, Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS, Lucide icons, Socket.IO client |
| API | Node.js 20+, Express 5, Mongoose (MongoDB), Socket.IO, Zod, JWT, bcrypt, Helmet, express-rate-limit, sharp, pino |
| Tests | Vitest + Supertest + mongodb-memory-server (API), Vitest + Testing Library (web), Playwright (end-to-end) |

> This project replaced an earlier static HTML/Java servlet prototype (no working backend, plaintext passwords). The brand, logo and password-strength rules were carried over; the rest was rebuilt. The old code remains in git history (`0818c40`).

---

## Repository layout

```
server/            Express API + Socket.IO
  src/config       env validation (zod), MongoDB connection
  src/models       Mongoose schemas and indexes
  src/controllers  request handlers
  src/routes       REST routes per API group
  src/services     auth, privacy rules, notifications, storage, messaging, cascades
  src/middleware   auth, validation, rate limits, uploads, errors
  src/validators   zod request schemas
  src/sockets      authenticated Socket.IO server + emitter
  tests/           API integration tests (in-memory MongoDB)
client/            React app
  src/styles/tokens.css   design tokens (palette, radius, shadows, layout)
  src/components          ui/, layout/, posts/, users/, stories/, messages/, notifications/
  src/pages               one file per screen
  src/lib                 API client, socket, cache helpers, validation
e2e/               Playwright journeys + responsive checks
```

## Running locally

Requirements: Node.js 20+ and MongoDB 6+ (local `mongod` or a MongoDB Atlas URI).

```bash
npm install                          # installs root, server and client workspaces
cp server/.env.example server/.env   # then set the two JWT secrets (see below)
cp client/.env.example client/.env   # optional; defaults to http://localhost:4000
npm run dev                          # API on :4000, web app on :5173
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Open http://localhost:5173 and sign up. Email verification and password-reset links are **printed in the API log** when SMTP isn't configured (development only).

To try **real-time messaging**, open a second browser profile (or a private window), sign up a second user, open the other user's profile and press **Message**. Messages, typing indicators, read receipts ("Seen"), unread badges and notifications update live in both windows.

Make an account a moderator (enables the Moderation screen):

```bash
npm run make-moderator -w server -- <username> [moderator|admin|user]
```

## Configuration

All server settings are environment variables, validated at startup (`server/src/config/env.js`). See `server/.env.example` for the full list.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | **Primary (and only) database.** |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥32-char random secrets. |
| `CLIENT_ORIGINS` | Comma-separated allow-list for CORS and Socket.IO. |
| `APP_URL` / `PUBLIC_SERVER_URL` | Used for email links / local media URLs. |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | Use `true` / `none` in production when the web app and API are on different domains. |
| `TRUST_PROXY` | Number of proxies in front of the API (Render: `1`) so rate limits see real client IPs. |
| `STORAGE_DRIVER` | `local` (disk, served at `/uploads`) or `cloudinary` (+ `CLOUDINARY_*`). |
| `SMTP_*`, `MAIL_FROM` | Outgoing email. Without SMTP, dev logs links; production logs an error. |

Client: `VITE_API_URL` — base URL of the API.

## Testing

```bash
# API integration tests (34): auth, refresh rotation/reuse detection, privacy, blocking,
# uploads, counters, comments, notifications, messaging access control, sockets, moderation
MONGOMS_SYSTEM_BINARY=$(which mongod) npm test -w server

# Web unit tests (9): validation, safe rich text, API client refresh/error handling
npm test -w client

# End-to-end (Playwright): spins up its own API + in-memory MongoDB + Vite dev server
npx playwright install chromium
MONGOMS_SYSTEM_BINARY=$(which mongod) npm run test:e2e

npm run lint && npm run build
```

`MONGOMS_SYSTEM_BINARY` reuses your local `mongod`; omit it and mongodb-memory-server downloads a MongoDB binary instead.

E2E coverage: sign-up (with validation), profile editing and avatar upload, posting with an image, logout and protected-route redirects; search → follow → like → bookmark → comment with mention; notifications; live messages with typing indicator and read receipt (two browser contexts); private-account requests and approval; blocking; and no horizontal overflow on six screens at desktop (1440), tablet (820) and mobile (Pixel 7) sizes.

## Architecture notes

### Database: MongoDB only
Everything lives in MongoDB. No requirement here (reporting, financial data, cross-entity transactions) justifies a second, relational database, so none was added.

Modelling choices:
- High-volume relationships are **separate collections** (`Follow`, `Like`, `Bookmark`, `Block`, `StoryView`, `Message`), never unbounded arrays, each with unique compound indexes (no duplicate follows, likes or bookmarks).
- Counters (`followersCount`, `likesCount`, `commentsCount`, …) are updated with atomic `$inc` **only when the underlying row actually changed**, so concurrent or repeated requests can't drift them (covered by tests).
- `Post.audience` is denormalised from the author's privacy setting so Explore, hashtag and search queries filter without joins; it is rewritten when the author toggles privacy.
- Stories and story views expire through MongoDB TTL indexes (24 h). Sessions and email tokens expire through TTL as well.
- All lists use cursor pagination (`_id`-descending; conversations by `lastActivityAt`).
- Multi-step deletes (post → comments → likes → bookmarks → notifications → media) run as ordered operations without transactions, so they work on a standalone `mongod`. A crash mid-cascade can leave orphaned rows, which readers already ignore (e.g. populated `null` authors are filtered).

### Auth & security
- Passwords: bcrypt (12 rounds). Login failures return one generic message, with timing equalised for unknown users.
- Short-lived JWT access token (15 min, memory only on the client) plus a rotating opaque refresh token in an `httpOnly` cookie scoped to `/api/auth`. Refresh tokens are stored as HMACs; replaying a rotated token revokes the session. Password change/reset revokes all sessions and invalidates older access tokens.
- Cookie endpoints require `X-Requested-With`, which forces a CORS preflight that the origin allow-list rejects (CSRF guard).
- Every request part is validated by strict Zod schemas (unknown keys rejected, which blocks `{"$gt": ""}` style NoSQL injection and mass assignment); `$`/dotted keys are also stripped from JSON bodies.
- Ownership is always derived from the verified token, never from client-supplied IDs.
- Uploads: type checked from file bytes (not the declared MIME type); images re-encoded with sharp (EXIF/GPS stripped, resized); size limits of 10 MB per image and 50 MB per video; at most 10 files and one video per post.
- Helmet security headers, strict CORS, 100 KB JSON limit, per-route rate limits (auth, email, writes, messages, uploads), and pino logs with tokens, cookies and passwords redacted.
- Private accounts and blocks are enforced server-side on profiles, posts, comments, likes, stories, search, follower lists, notifications and messaging. Blocked content returns 404 so blocking isn't observable.
- Sockets authenticate with the access token on every connect and are disconnected when it expires (the client reconnects with a fresh token). Typing events check conversation membership and blocks on each emit. Message sending goes through REST (validated, rate limited, idempotent via `clientId`), with sockets only delivering.

### Feed
Chronological fan-out on read: posts by accounts you follow plus your own, newest first. Explore shows recent public media posts; Reels shows video posts visible to you. No ranking algorithm is applied.

### Design system
The four-colour palette lives in `client/src/styles/tokens.css` as CSS variables (`--color-background #FFF5F5`, `--color-soft-pink #F7D6D0`, `--color-rose #E2B4BD`, `--color-charcoal #4A4A4A`, plus white surfaces) and is mapped into Tailwind (`bg-background`, `bg-blush`, `bg-rose`, `text-charcoal`, …). Three derived shades keep WCAG contrast: muted text (5.3:1 on blush), a deeper rose for icon states (≥3:1) and a danger red. Change the palette in one file.

Layout: three columns on desktop (sidebar · content · suggestions/trending rail at ≥1280px), an icon sidebar on tablets, and a top bar with a bottom tab bar (centred create button, safe-area padding) on phones. Components are keyboard accessible (focus-trapped dialogs, arrow-key menus, visible focus rings, labelled controls, `prefers-reduced-motion` respected).

## Deployment

- **Database:** MongoDB Atlas. Indexes are synced on boot. Enable Atlas continuous backups or scheduled snapshots.
- **API:** Render (or any Node host). Build `npm install`, start `npm start -w server`. Health check `/health`, readiness check `/ready`. Set `NODE_ENV=production`, `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `CLIENT_ORIGINS=https://<your-web-app>`, `APP_URL`, `PUBLIC_SERVER_URL` and the secrets. Shutdown on SIGTERM is graceful.
- **Media:** set `STORAGE_DRIVER=cloudinary` with credentials. Local disk storage is not persistent on most hosts.
- **Web app:** Vercel/Netlify. Build `npm run build -w client`, output `client/dist`, set `VITE_API_URL`, and add an SPA fallback rewrite (`/* → /index.html`).
- **Email:** configure SMTP (e.g. Postmark, SES, Resend SMTP) for verification and reset emails.

## Known limitations

- **Single API instance for realtime.** Presence and socket rooms are in memory. Running several API instances needs the Socket.IO Redis adapter (not added because nothing currently requires horizontal scaling).
- **Cloudinary driver and SMTP are untested here** (no credentials available). Both are implemented per the providers' documented APIs, and local storage and the dev email log are what the tests exercise.
- Videos are stored as uploaded (type and size checked, but not transcoded or thumbnailed); grid tiles use the first video frame.
- One-to-one messages only (no group chats, attachments or message deletion). Deleting an account deletes its conversations for both participants.
- Moderation can dismiss reports or remove posts/comments. There's no account suspension, and moderator roles are granted via the CLI script.
- Image cropping from the old prototype wasn't carried over; images are resized server-side, keeping their aspect ratio.
- Search uses prefix/regex matching on usernames and names, and MongoDB text search for posts. That's fine at small scale; a search service would be needed later.
- No dark mode; the specified light palette is the only theme.
- Email verification is encouraged with a banner but not required to use the app.
