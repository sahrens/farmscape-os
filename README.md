# FarmscapeOS

**Open-source 3D farm and agroforestry management system.**

Interactive 3D property viewer, element tracking, activity logging, data explorer, and full audit trail — deployed to Cloudflare's edge in minutes.

> **For AI agents:** See [Getting Started with an AI Agent](#getting-started-with-an-ai-agent) below.

---

## Features

| Feature | Description |
|---------|-------------|
| **3D Property Viewer** | Interactive Three.js scene with property boundary, structures, trees, zones, and infrastructure. Orbit, zoom, and click to select. |
| **Element Management** | Track every tree, building, garden bed, and infrastructure item with position, dimensions, rotation, and metadata. |
| **Activity Logging** | Log watering, pruning, planting, harvesting, fertilizing, and other activities per element with timestamps. |
| **Data Explorer** | Browse all database tables with column selection, filtering, sorting, pagination, and a raw SQL editor. |
| **Changelog Audit Trail** | Every mutation automatically records who changed what, when, and the JSON diff of the change. |
| **DB Versioning** | Export/import database snapshots as JSON files for Git-based version control. |
| **Donation Support** | Built-in configurable donation links for farm-specific and upstream project support. |
| **Mobile-First** | Bottom-sheet sidebar on mobile, touch-friendly activity buttons, `100dvh` viewport. |
| **Edge-Deployed** | Cloudflare Workers + D1 (SQLite at edge) + static assets. Fast everywhere, cheap to run. |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Three.js, @react-three/fiber |
| State | Zustand |
| Routing | Wouter |
| API | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite at edge) |
| Auth | Simple password with HttpOnly cookie |
| Hosting | Cloudflare Pages + Workers |

Zero external dependencies beyond Cloudflare. No Node server, no traditional database.

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

I'd like to use the default password-based auth for now.
````

The agent will walk you through the full setup interactively.

---

## Manual Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [Cloudflare account](https://dash.cloudflare.com/) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

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

### 5. Set the auth password

```bash
npx wrangler secret put AUTH_PASSWORD
# Enter your chosen password when prompted
```

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

Your app is live at `https://farmscapeos.<your-subdomain>.workers.dev`

### 8. Local development

```bash
pnpm run dev
```

The Vite dev server starts at `http://localhost:5173` with API proxy to your deployed Worker.

---

## Project Structure

```
src/
  farm.config.ts          ← Active farm config (re-exports from farms/)
  farms/
    example.config.ts     ← Template — copy and customize for your farm
  lib/
    api.ts                ← API client (fetch wrappers)
    store.ts              ← Zustand state management
    types.ts              ← TypeScript interfaces
  components/
    FarmScene.tsx          ← 3D viewer (Three.js + R3F)
    Sidebar.tsx            ← Element list + detail panel + activity form
    Toolbar.tsx            ← View controls and status filters
    DonationBanner.tsx     ← Configurable donation links
  pages/
    Login.tsx              ← Password auth page
    DataExplorer.tsx       ← Table browser + SQL editor
worker/
  index.ts                ← Cloudflare Worker API (all endpoints)
scripts/
  db-dump.sh              ← Export D1 tables to JSON for Git versioning
  db-import.sh            ← Import JSON snapshots into D1
db-snapshots/             ← JSON exports of all tables (Git-versioned)
schema.sql                ← D1 database schema
wrangler.toml             ← Cloudflare deployment config
```

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
| `camera` | Default 3D viewer camera position and target |
| `ground` | Ground plane center and size |
| `colors` | Hex color overrides per element subtype |
| `subtypeLabels` | Human-readable labels per subtype |
| `donation` | Donation link configuration |

See `src/farms/example.config.ts` for a fully documented template.

---

## API Reference

All endpoints are under `/api/`. Auth-required endpoints need a valid `farm_auth` cookie.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login with password |
| GET | `/api/auth/check` | No | Check auth status |
| GET | `/api/elements` | No | List all elements |
| POST | `/api/elements` | Yes | Create element |
| PUT | `/api/elements/:id` | Yes | Update element |
| DELETE | `/api/elements/:id` | Yes | Delete element |
| GET | `/api/activities` | No | List activities (filter by `element_id`) |
| POST | `/api/activities` | Yes | Create activity |
| GET | `/api/observations` | No | List observations |
| POST | `/api/observations` | Yes | Create observation |
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
| `elements` | Every tree, structure, zone, infrastructure item |
| `activities` | Logged actions (watering, pruning, etc.) per element |
| `observations` | Photos, health notes, measurements per element |
| `changelog` | Automatic audit trail for all mutations |
| `gps_tracks` | Continuous GPS position logging (future) |

Activities and observations have an `is_test` column (0 = real, 1 = test) so test data can be filtered out.

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

## Coordinate System

All element positions use a **local coordinate system** defined in your farm config:

- **x** = east (from your chosen origin point)
- **y** = north (from your chosen origin point)
- **z** = elevation offset

Pick any corner of your property as `(0, 0)` and measure other positions relative to it. You can use GPS coordinates converted to a local system, survey data, or direct measurements.

The 3D viewer converts these to Three.js coordinates automatically.

---

## Donations

FarmscapeOS supports configurable donation links at two levels:

1. **Farm-specific donations** — each deployment can link to its own donation page
2. **Upstream project donations** — a configurable percentage suggestion for supporting FarmscapeOS development

Configure in your farm config:

```ts
donation: {
  farmUrl: 'https://your-donation-page.com',
  farmLabel: 'Support Our Farm',
  upstreamPercent: 5,  // Suggested % to upstream
  upstreamUrl: 'https://github.com/sponsors/sahrens',
},
```

---

## Security: Secret Detection

FarmscapeOS includes a pre-commit hook that prevents accidental leaks of private data. It combines:

1. **[gitleaks](https://github.com/gitleaks/gitleaks)** — 800+ built-in rules for API keys, tokens, passwords, private keys, JWTs, and more, plus custom rules in `.gitleaks.toml` for Cloudflare-specific patterns
2. **Forbidden path checks** — blocks commits containing `.env`, `.pem`, `.key`, `db-snapshots/`, and other sensitive files
3. **Custom patterns** (`.secret-patterns`) — add your own farm-specific terms (property name, address, personal info) that should never appear in the OSS repo

### Setup

```bash
# Enable the hook (run once after cloning)
git config core.hooksPath .githooks

# Install gitleaks
brew install gitleaks          # macOS
sudo apt install gitleaks      # Debian/Ubuntu
go install github.com/gitleaks/gitleaks/v8@latest  # Go

# Create your personal secret patterns (gitignored)
cp .secret-patterns.example .secret-patterns
# Edit .secret-patterns with your farm name, address, email, etc.
```

The hook runs automatically on every `git commit`. To bypass for false positives: `git commit --no-verify`.

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

---

## License

MIT License. See [LICENSE](LICENSE).

Built with care for farmers, gardeners, food foresters, and land stewards everywhere.
