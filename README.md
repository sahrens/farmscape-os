# FarmscapeOS

**Open-source 3D farm and agroforestry management system.**

Interactive 3D property viewer, element tracking, activity logging, member management, fieldwork tools, data explorer, and full audit trail — deployed to Cloudflare's edge in minutes.

> **For AI agents:** See [Getting Started with an AI Agent](#getting-started-with-an-ai-agent) below.

---

## Features

| Feature | Description |
|---------|-------------|
| **3D Property Viewer** | Interactive Three.js scene with property boundary, structures, trees, zones, and infrastructure. Orbit, zoom, and click to select. |
| **3D Edit Mode** | Select any element and enter edit mode: drag the pinhead to move it on the ground plane, drag the ring to rotate. Purely imperative Three.js — no React re-renders during drag. |
| **Element Management** | Track every tree, building, garden bed, and infrastructure item with position, dimensions, rotation, GPS, and metadata. Create, update, and delete from the UI. |
| **Fieldwork** | Mobile-first fieldwork tab with element cards, search/filter, quick activity logging, "Add Element" form, and "Edit in 3D" button to jump to the map in edit mode. |
| **Activity Logging** | Log watering, pruning, planting, harvesting, fertilizing, and other activities per element with timestamps. |
| **Member Management** | Invite users by email, assign roles (admin/member/read), manage team from the Members page. |
| **Data Explorer** | Browse all database tables with column selection, filtering, sorting, pagination, and a raw SQL editor. |
| **Bug Reporting** | In-app bug report button with auto-captured screenshots, console logs, viewport info, and optional GitHub issue creation. |
| **Changelog Audit Trail** | Every mutation automatically records who changed what, when, and the JSON diff of the change. |
| **DB Versioning** | Export/import database snapshots as JSON files for Git-based version control. |
| **Donation Support** | Built-in configurable donation links for farm-specific and upstream project support. |
| **Mobile-First** | Bottom-sheet sidebar on mobile, touch-friendly activity buttons, `100dvh` viewport, safe area handling. |
| **Edge-Deployed** | Cloudflare Workers + D1 (SQLite at edge) + static assets. Fast everywhere, cheap to run. |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Three.js, @react-three/fiber, @react-three/drei |
| State | Zustand |
| Routing | Wouter |
| API | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite at edge) |
| Auth | Email OTP magic link via AgentMail (passwordless) |
| Email | AgentMail API (`api.agentmail.to`) |
| Hosting | Cloudflare Workers (serves both API and static assets at edge) |

Zero external dependencies beyond Cloudflare and AgentMail. No Node server, no traditional database.

---

## Getting Started with an AI Agent

**Paste this to your AI coding agent (Manus, Cursor, Claude, etc.) to get set up:**

````
I want to set up FarmscapeOS for my property. Here's the project:
https://github.com/sahrens/farmscape-os

Please:
1. Read the README at that repo for full setup instructions
2. Interview me about my property to create a custom farm config:
   - Property name and address
   - Unit system (feet or meters)
   - Property boundary coordinates (I can provide GPS coords, a survey, or rough measurements)
   - What elements to track (trees, structures, garden beds, etc.)
   - Where I want to host it (Cloudflare is the default and recommended)
3. Create my farm config file (src/farms/myfarm.config.ts)
4. Set up the Cloudflare D1 database and seed it with my elements
5. Deploy to Cloudflare Workers
6. Set up the GitHub repo with DB snapshots for version control

I'd like to use the email magic link auth.
````

The agent will walk you through the full setup interactively.

---

## Manual Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [Cloudflare account](https://dash.cloudflare.com/) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [AgentMail account](https://agentmail.to/) (for email OTP auth)

### 1. Clone and install

```bash
git clone https://github.com/sahrens/farmscape-os.git
cd farmscape-os
pnpm install

# Enable the secret-detection pre-commit hook
git config core.hooksPath .githooks
```

### 2. Create your farm config

Copy the example and customize it for your property:

```bash
cp src/farms/example.config.ts src/farms/myfarm.config.ts
```

Edit `src/farms/myfarm.config.ts` with your property details:
- **name**: Your farm/garden name
- **boundary**: Property boundary polygon in local coordinates
- **geoReference**: GPS origin, bearing, and metersPerUnit for coordinate conversion
- **camera**: Default 3D viewer camera position
- **colors**: Color overrides for your element subtypes
- **subtypeLabels**: Human-readable labels for your subtypes

Then update `src/farm.config.ts` to import your config:

```ts
import myFarm from './farms/myfarm.config';
export default myFarm;
```

### 3. Create D1 database

```bash
# Login to Cloudflare
npx wrangler login

# Create the database
npx wrangler d1 create farmscapeos-db

# Note the database_id and update wrangler.toml
```

Update `wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "farmscapeos-db"
database_id = "your-database-id-here"
```

### 4. Initialize the schema

```bash
npx wrangler d1 execute farmscapeos-db --file=schema.sql
```

### 5. Set the AgentMail API key

Auth uses email OTP magic links sent via AgentMail. You need an AgentMail API key and an inbox.

```bash
# IMPORTANT: use printf, not echo — echo adds a trailing newline
printf 'am_us_yourkey' | npx wrangler secret put AGENTMAIL_API_KEY
```

Update the inbox address in `worker/index.ts` if you use a different inbox than the default (`atlas-nav@agentmail.to`).

> **Note:** After setting a secret on a newly created worker, you must redeploy (`npx wrangler deploy`) for the secret to take effect.

### 6. Seed your elements

You can seed elements via:
- The **Data Explorer** SQL editor (after deploying)
- The **import script**: `./scripts/db-import.sh` (from JSON snapshots)
- Direct D1 API calls

### 7. Build and deploy

```bash
pnpm run build
npx wrangler deploy
```

Your app is live at `https://<worker-name>.<your-subdomain>.workers.dev`

The URL is determined by the `name` field in `wrangler.toml` and your Cloudflare account's Workers subdomain. Keep the worker name short (e.g. `app`, `farm`) for a clean URL.

### 8. Local development

```bash
pnpm run dev
```

The Vite dev server starts at `http://localhost:5173` with API proxy to your deployed Worker.

---

## Authentication

FarmscapeOS uses **passwordless email OTP** for authentication. The flow is:

1. User enters their email on the login page
2. Server generates a 6-digit OTP code and a magic link, sends both via AgentMail
3. User either clicks the magic link or enters the code manually
4. Server verifies the code, creates a session, sets an HttpOnly cookie
5. On first login, user is prompted to set a display name

Users must be invited by an admin before they can log in. The first user (seeded directly in the DB) becomes the admin.

**Email provider:** [AgentMail](https://agentmail.to/) — the Send Message API (`POST /v0/inboxes/:inbox_id/messages/send`) with fields `to`, `subject`, `text`, and optional `html` and `headers`.

---

## Project Structure

```
src/
  farm.config.ts          ← Active farm config (re-exports from farms/)
  farm.config.types.ts    ← TypeScript types for farm config
  farms/
    example.config.ts     ← Template — copy and customize for your farm
  lib/
    api.ts                ← API client (fetch wrappers for all endpoints)
    store.ts              ← Zustand state management (auth, elements, edit mode, camera, CRUD)
    types.ts              ← TypeScript interfaces (FarmElement, Activity, User, etc.)
    geo.ts                ← GPS ↔ local coordinate conversion (localToGps, gpsToLocal)
  hooks/
    useConsoleCapture.ts  ← Console log capture for bug reports
    useVersionCheck.ts    ← Auto-reload on new deploys
  components/
    FarmScene.tsx          ← 3D viewer (Three.js + R3F), edit gizmo, camera controller
    Sidebar.tsx            ← Element list + detail panel + activity form + edit button
    Toolbar.tsx            ← View controls, status/type filters, element count
    DonationBanner.tsx     ← Configurable donation links
    BugReportButton.tsx    ← In-app bug reporting with screenshot capture
  pages/
    Login.tsx              ← Email OTP auth (3-step: email → code → name)
    Fieldwork.tsx          ← Element cards, add element form, edit in 3D, activity logging
    Members.tsx            ← Member management (invite, roles, remove)
    Vision.tsx             ← Farm vision / about page
    DataExplorer.tsx       ← Table browser + SQL editor + changelog
worker/
  index.ts                ← Cloudflare Worker API (all endpoints, auth, email)
tests/
  bundle-security.test.ts ← Production bundle leak detection (7 checks)
scripts/
  db-dump.sh              ← Export D1 tables to JSON for Git versioning
  db-import.sh            ← Import JSON snapshots into D1
db-snapshots/             ← JSON exports of all tables (Git-versioned)
schema.sql                ← D1 database schema
wrangler.toml             ← Cloudflare deployment config
```

---

## 3D Edit Mode

The 3D viewer supports an edit mode for repositioning and rotating elements:

**Entering edit mode:** Click "Edit" on an element card in the Sidebar, or "Edit in 3D" from the Fieldwork tab. The camera focuses on the element and edit handles appear.

**Handles:**
- **Pinhead (blue sphere on a pole)** — rises above the element. Grab and drag to move the element on the ground plane.
- **Rotation ring (orange ring at base)** — flat ring around the element. Grab and drag to rotate.

**Implementation:** During drag, the element's Three.js group is moved imperatively via refs — no zustand store updates, no React re-renders. The store is updated once on pointer up, then persisted to the API. This prevents the blank-screen crashes that occurred with per-frame store updates on mobile devices.

**Element group registry:** Each `ElementMesh` registers its Three.js group into a module-level `Map<string, THREE.Group>` on mount. The edit gizmo looks up the element's group from this registry to move it directly.

---

## GPS and Coordinate System

All element positions use a **local coordinate system** defined in your farm config, with automatic GPS conversion:

- **x** = east (from your chosen origin point)
- **y** = north (from your chosen origin point)
- **z** = elevation offset

The `geoReference` in your farm config defines the conversion:
- **origin**: GPS coordinates of the local (0, 0) point
- **bearing**: Rotation angle from true north (degrees)
- **metersPerUnit**: Scale factor (e.g., 0.3048 for feet)

GPS coordinates (lat/lng) are automatically computed from local positions using `localToGps()` in `src/lib/geo.ts`. When creating or moving elements, GPS is synced automatically.

---

## Configuration

All farm-specific data lives in a single config file under `src/farms/`. The config defines:

| Field | Purpose |
|-------|---------|
| `name` | Farm name shown in the UI |
| `subtitle` | Optional tagline |
| `address` | Optional physical address |
| `unit` / `unitLabel` | Coordinate system units (`ft` or `m`) |
| `boundary` | Property boundary polygon (local coordinates) |
| `overlays` | Optional secondary lines (clearing edges, fences) |
| `geoReference` | GPS origin, bearing, metersPerUnit for coordinate conversion |
| `camera` | Default 3D viewer camera position and target |
| `ground` | Ground plane center and size |
| `colors` | Hex color overrides per element subtype |
| `subtypeLabels` | Human-readable labels per subtype |
| `donation` | Donation link configuration |

See `src/farms/example.config.ts` for a fully documented template.

---

## API Reference

All endpoints are under `/api/`. Auth-required endpoints need a valid `farm_session` cookie.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/request-otp` | No | Send OTP code + magic link to email |
| POST | `/api/auth/verify-otp` | No | Verify OTP code, create session |
| GET | `/auth/verify` | No | Magic link handler (redirects) |
| GET | `/api/auth/check` | No | Check current session status |
| POST | `/api/auth/logout` | Yes | Destroy session |
| POST | `/api/auth/set-name` | Yes | Set display name (first login) |

### Members

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/members` | Admin | List all members |
| POST | `/api/members/invite` | Admin | Invite user by email with role |
| PUT | `/api/members/:id` | Admin | Update member role |
| DELETE | `/api/members/:id` | Admin | Remove member |
| POST | `/api/members/resend-invite` | Admin | Resend invite email |

### Elements

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/elements` | No | List all elements |
| POST | `/api/elements` | Yes | Create element |
| PUT | `/api/elements/:id` | Yes | Update element |
| DELETE | `/api/elements/:id` | Yes | Delete element |

### Activities & Observations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/activities` | No | List activities (filter by `element_id`) |
| POST | `/api/activities` | Yes | Create activity |
| GET | `/api/observations` | No | List observations |
| POST | `/api/observations` | Yes | Create observation |

### Bug Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/bug-reports` | Yes | Submit bug report (with screenshot, console logs) |
| GET | `/api/bug-reports` | Admin | List bug reports |
| GET | `/api/bug-reports/:id` | Admin | Get bug report with attachments |
| POST | `/api/bug-reports/upload` | Yes | Upload attachment to bug report |

### Data Explorer

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/data/tables` | No | List tables with row counts |
| GET | `/api/data/schema` | No | Get table column info |
| GET | `/api/data/query` | No | Query table with filters/sort/pagination |
| GET | `/api/data/distinct` | No | Get distinct values for a column |
| POST | `/api/data/sql` | Yes | Execute raw SQL |
| GET | `/api/data/export` | No | Export full table as JSON |
| POST | `/api/data/import` | Yes | Bulk import rows |
| GET | `/api/data/changelog` | No | View changelog entries |

---

## Database Schema

See `schema.sql` for the full schema. Key tables:

| Table | Purpose |
|-------|---------|
| `elements` | Every tree, structure, zone, infrastructure item (with GPS + local coords) |
| `activities` | Logged actions (watering, pruning, etc.) per element |
| `observations` | Photos, health notes, measurements per element |
| `users` | User accounts with roles (admin/member/read) and status (invited/active) |
| `sessions` | Auth session tokens tied to users |
| `otp_codes` | Short-lived email verification codes |
| `bug_reports` | User-submitted issues with screenshots and console logs |
| `bug_report_attachments` | Uploaded files attached to bug reports |
| `changelog` | Automatic audit trail for all mutations |
| `gps_tracks` | Continuous GPS position logging (future) |

Activities and observations have an `is_test` column (0 = real, 1 = test) so test data can be filtered out.

---

## Cloudflare Secrets

| Secret | Purpose |
|--------|---------|
| `AGENTMAIL_API_KEY` | AgentMail API key for sending OTP and invite emails |
| `GITHUB_TOKEN` | (Optional) Fine-grained GitHub PAT for auto-creating issues from bug reports |

Set secrets with:

```bash
# IMPORTANT: use printf, not echo (echo adds a trailing newline)
printf 'value' | npx wrangler secret put SECRET_NAME

# Then redeploy for the secret to take effect
npx wrangler deploy
```

---

## Bundle Security

The production build is checked for accidental data leaks via `pnpm test:bundle` (7 automated checks):

1. No local filesystem paths (`/home/`, `/Users/`)
2. No `jsxDEV` runtime (development mode leak)
3. No Cloudflare credentials
4. No private email addresses
5. No Resend/AgentMail API keys
6. No environment variable values embedded in bundle
7. Farm-specific names only appear in the `farm.config` chunk

A pre-commit hook (`.githooks/pre-commit`) runs gitleaks and checks `.secret-patterns` for farm-specific terms that should never appear in the OSS repo.

---

## Database Versioning

FarmscapeOS includes scripts to export and import D1 data as JSON files, enabling Git-based version control of your farm data.

### Export (dump)

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_D1_DB_ID="your-db-id"
export CLOUDFLARE_API_KEY="your-api-key"
export CLOUDFLARE_EMAIL="your-email"

./scripts/db-dump.sh
git add db-snapshots/ && git commit -m "DB snapshot $(date -u +%Y-%m-%d)"
```

### Import (restore/bulk edit)

Edit the JSON files in `db-snapshots/`, then:

```bash
./scripts/db-import.sh              # Import all tables
./scripts/db-import.sh elements     # Import only elements
```

---

## Donations

FarmscapeOS supports configurable donation links at two levels:

1. **Farm-specific donations** — each deployment can link to its own donation page
2. **Upstream project donations** — a configurable percentage suggestion to the FarmscapeOS project

Configure in your farm config:

```ts
donation: {
  farmUrl: 'https://your-donation-page.com',
  farmLabel: 'Support Our Farm',
  upstreamPercent: 5,
  upstreamUrl: 'https://github.com/sponsors/sahrens',
},
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| OTP email not arriving | AgentMail API key missing or invalid | Verify `AGENTMAIL_API_KEY` secret is set, redeploy |
| Magic link says "expired" | Code older than 10 minutes | Request a new code from the login page |
| Login says "not invited" | Email not in the users table | Admin must invite the user first from the Members page |
| Secret not taking effect | Worker needs redeploy after secret change | Run `npx wrangler deploy` after setting the secret |
| Deploy goes to wrong account | Wrangler account cache | `rm -rf node_modules/.cache/wrangler` then redeploy |
| Blank screen during 3D drag | WebGL context loss on mobile | Error boundary should show recovery UI; if not, reload the page |

---

## Contributing

Contributions welcome! Please open an issue or PR.

Areas where help is especially appreciated:

- **New element types** (livestock, water features, soil sensors)
- **Offline support** (IndexedDB + background sync)
- **GPS field tracking** (browser Geolocation API)
- **Import/export** (KML, GeoJSON, CSV)
- **Internationalization** (i18n)
- **Accessibility** (screen reader support for 3D viewer)
- **Additional 3D models** (more tree species, building types)
- **HTML email templates** (currently plain text via AgentMail)

---

## License

MIT License. See [LICENSE](LICENSE).

Built with care for farmers, gardeners, food foresters, and land stewards everywhere.
