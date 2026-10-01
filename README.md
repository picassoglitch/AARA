# ara

minimal site for the ara artist persona.

## voice

all user-facing copy follows [docs/VOICE.md](docs/VOICE.md).

see also [docs/ORIGIN.md](docs/ORIGIN.md) for ara's founding story.

## stack choices

- **hono**: lightweight, runs on vercel edge and node. single codebase for dev and prod.
- **sqlite (dev) / postgres (prod)**: sqlite for zero-config local dev, postgres for vercel. same interface, swapped by env var.
- **local disk (dev) / vercel blob (prod)**: local uploads folder for dev, vercel blob for prod. same interface.
- **vanilla html/css/js frontend**: no build step for public pages. minimal, fast, in keeping with the aesthetic.

## file structure

```
ara-site/
├── api/
│   └── index.ts              # vercel functions entry
├── docs/
│   └── VOICE.md              # ara voice guide
├── public/
│   ├── index.html            # public artwork page
│   ├── queued.html           # queue confirmation page
│   ├── admin.html            # admin interface
│   └── styles.css            # shared styles
├── src/
│   ├── db/
│   │   ├── index.ts          # db factory (sqlite or postgres)
│   │   ├── interface.ts      # database interface
│   │   ├── sqlite.ts         # sqlite adapter
│   │   └── postgres.ts       # postgres adapter
│   ├── server/
│   │   ├── app.ts            # hono app setup
│   │   ├── utils.ts          # password hashing, tokens, etc
│   │   ├── routes/
│   │   │   ├── public.ts     # public api routes
│   │   │   └── admin.ts      # admin api routes
│   │   └── middleware/
│   │       ├── security.ts   # security headers, noindex
│   │       ├── csrf.ts       # csrf protection
│   │       └── rateLimit.ts  # rate limiting
│   ├── storage/
│   │   ├── index.ts          # storage factory
│   │   ├── interface.ts      # storage interface
│   │   ├── local.ts          # local disk adapter
│   │   └── vercel-blob.ts    # vercel blob adapter
│   ├── voice/
│   │   ├── index.ts          # exports
│   │   ├── config.ts         # banned words, generator prompt
│   │   └── validator.ts      # voice validation
│   ├── types.ts              # shared types
│   ├── dev.ts                # local dev server
│   └── seed.ts               # seed script
├── tests/
│   ├── auth.test.ts          # admin auth tests
│   ├── queue.test.ts         # queue ordering tests
│   ├── whitelist.test.ts     # first-10 whitelist tests
│   └── voice.test.ts         # voice validator tests
├── package.json
├── tsconfig.json
├── vercel.json
├── vitest.config.ts
└── .gitignore
```

## local development

```bash
npm install
npm run seed    # creates test data and prints admin password hash
npm run dev     # starts server at http://localhost:3000
```

the dev server prints the admin path on startup. default password: `ara-dev-password`

## environment variables

### local development

create `.env`:

```
ADMIN_PATH=_secret_admin_path
ADMIN_PASSWORD_HASH=<output from seed script>
```

### vercel production

| variable | required | description |
|----------|----------|-------------|
| `DATABASE_URL` | yes* | postgres connection string (neon, vercel postgres) |
| `BLOB_READ_WRITE_TOKEN` | yes* | vercel blob token (legacy auth) |
| `ADMIN_PATH` | yes | secret admin path (e.g. `_ara_console_x7k9m2`) |
| `ADMIN_PASSWORD_HASH` | yes | hashed admin password (use `npm run seed` to generate) |
| `IP_SALT` | recommended | salt for ip hashing in rate limiting |
| `NODE_ENV` | auto | set to `production` by vercel |

#### database url resolution

the code resolves the database url from the first non-empty value of these env vars (in order):

1. `DATABASE_URL`
2. `POSTGRES_URL`
3. `aara_DATABASE_URL`
4. `aara_POSTGRES_URL`
5. any env var ending with `_DATABASE_URL` (excluding `_UNPOOLED`)
6. any env var ending with `_POSTGRES_URL` (excluding `_UNPOOLED`)

this handles vercel integrations (e.g., neon) that create prefixed env vars like `aara_DATABASE_URL`. pooled urls are preferred over unpooled.

if running on vercel (`VERCEL` env var is set) and no postgres url resolves, the app throws an error instead of falling back to sqlite.

#### blob storage resolution

the code selects vercel blob storage when any of these env vars are set:

1. `BLOB_READ_WRITE_TOKEN` (legacy token auth)
2. `aara_BLOB_READ_WRITE_TOKEN`
3. any env var ending with `_BLOB_READ_WRITE_TOKEN`
4. `BLOB_STORE_ID` (oidc auth, used with `VERCEL_OIDC_TOKEN`)
5. `aara_BLOB_STORE_ID`
6. any env var ending with `_BLOB_STORE_ID`

when only `BLOB_STORE_ID` is set (no token), the `@vercel/blob` sdk uses oidc to authenticate automatically at runtime.

if running on vercel and no blob config resolves, the app throws an error instead of writing to local disk (which would fail on vercel's read-only filesystem).

## queue ordering rule

waitlist entries are ordered by:
1. **whitelist status** (whitelisted first)
2. **engagement score** (likes + shares + tags, descending)
3. **signup time** (earliest first)

## first-10 whitelist mechanic

when a campaign link is clicked:
- first 10 unique visitors (dedupe by hashed ip) who then sign up get a whitelist spot
- whitelist status is flagged on their waitlist entry
- whitelisted entries appear before all non-whitelisted entries in the queue

## what's built and working

- [x] public artwork page with date/title line
- [x] waitlist signup with honeypot
- [x] queue confirmation page (position looked up by token)
- [x] admin at non-obvious env path
- [x] admin password auth with hashed compare
- [x] rate-limited login
- [x] httpOnly session cookies
- [x] csrf protection on all mutations
- [x] noindex on admin
- [x] artwork upload and management
- [x] set current artwork
- [x] waitlist management with engagement scores
- [x] campaign link generator
- [x] campaign click tracking with deduplication
- [x] first-10 whitelist attribution
- [x] stub pages: /i/:code (qr invite), /verify/:id (nft), /t/:id (nfc)
- [x] voice validator (rejects banned words, emoji, exclamation points, length)
- [x] generator prompt constant for future ai messages
- [x] security headers (csp, x-frame-options, etc)
- [x] sqlite adapter for local dev
- [x] postgres adapter for production
- [x] vercel blob adapter for production
- [x] vercel.json with rewrites
- [x] tests for queue ordering, whitelist, auth, voice

## left to wire up

- [ ] **real bucket/cdn**: currently using vercel blob, may want cloudflare r2 or aws s3 for cost
- [ ] **deploy target**: vercel config ready, needs actual deployment
- [ ] **production domain**: aara.art dns configuration
- [ ] **ai messages for qr invites**: generator prompt ready, needs llm integration
- [ ] **nft chain verification**: /verify/:id is a stub, needs on-chain lookup
- [ ] **nfc tag programming**: /t/:id is a stub, needs tag provisioning workflow
- [ ] **social engagement ingestion**: engagement scores are admin-settable, could automate via api
- [ ] **email notifications**: "you will be contacted" is manual for now
- [ ] **admin 2fa**: single password auth, could add totp
- [ ] **backup/export**: waitlist csv export, database backups
- [ ] **analytics**: basic click tracking exists, no dashboards

## routes

| path | description |
|------|-------------|
| `/` | public artwork page |
| `/queued.html?id=<token>` | queue confirmation |
| `/<ADMIN_PATH>` | admin interface |
| `/c/:code` | campaign short link (redirects with ref param) |
| `/i/:code` | qr invite landing (stub) |
| `/verify/:id` | nft verification (stub) |
| `/t/:id` | nfc tag destination (stub) |
| `/api/artwork/current` | get current artwork |
| `/api/waitlist` | signup (POST) |
| `/api/waitlist/position?token=` | lookup position |
| `/api/campaign/:code/click` | record campaign click |

## tests

```bash
npm test
```

tests cover:
- queue ordering (whitelist → engagement → time)
- first-10 whitelist mechanics
- admin authentication (password hashing, sessions, rate limiting)
- voice validator (banned words, emoji, exclamation points, length)
