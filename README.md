# SafarNav

**Not just the shortest route. The safer one.**

A Next.js route planner that compares routes using mapped infrastructure, expected business opening hours at the time you pass, travel mode and daylight. Every displayed indicator comes from deterministic, inspectable calculations. Gemini provides an optional explanation; it never assigns the score.

> Safety scores are estimates based on available infrastructure and mapping data. They do not guarantee personal safety.

## Start locally — no accounts required

Use Node.js 22 LTS or newer (Node 24 LTS recommended for deployment), npm, and Git. This project was built on Node 26. The lockfile pins the tested packages.

```bash
cd "/Users/karanbhura/CODING/VIHAAN X 9.0"
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. Click **Compare routes**. Demo mode is enabled by default, even without an environment file. It uses a fixed New Delhi journey with fictional, explicitly labelled infrastructure; these are not real road directions. Demo feedback is acknowledged without persistence. Map tiles still need an internet connection.

Try Walking and Driving, move Time Machine to late evening, inspect individual sections, click View Summary, review an Uber stop in Driving, then start a journey and finish it manually to test feedback. Location permission is requested only by My location or Start journey.

For a production build locally:

```bash
npm run build
npm start
```

Webpack is explicitly selected for development and production because Turbopack's CSS worker could not create its required port in the local build environment. It is a supported Next.js compiler and works on Vercel.

## What is implemented

- Responsive map-first desktop layout and collapsible mobile planning sheet; light/dark UI.
- Lazy MapLibre map, place markers, route selection, weak-section overlays, POI details, accuracy circle, recentering and attribution.
- Geoapify search suggestions, current location, map selection, swap, Walking/Driving, up to three ORS alternatives, overlap deduplication.
- Bounded Overpass infrastructure queries with normalized OSM identifiers, road geometries, tags, opening hours and cache timestamps.
- Approximately 150 m sections, eight typed mode-specific weights, deterministic scoring, distance-weighted route totals, weakest-section statistics, separate evidence confidence.
- Time Machine with 15-minute steps over 24 hours, timezone-aware expected passing times, daylight and opening-hours reevaluation. It reuses the server-authenticated geographic snapshot rather than calling routing again.
- On-demand Gemini structured explanations with validation and computed fallback.
- Driving handoff preview, optional public-parking candidate, explicit consent, live routing verification and manual-stop fallback.
- Foreground GPS progress, accuracy, pause/resume, off-route detection, upcoming weak-section alerts, arrival confirmation and discard.
- Anonymous feedback, Neon/Drizzle persistence and migrations; no login, GPS history or mandatory database dependency for planning.
- Bounded input validation, cross-origin rejection, rate limits, authenticated encrypted expiring snapshots, provider timeouts, caches, tests and deployment instructions.
- Web app manifest and icon. **No offline routing or background-navigation service worker.**

## Configure real geographic data

Edit `.env.local` and restart the dev server. Never paste secrets into source files or commit `.env.local`.

| Variable                    | Required?              | What to enter                                                                                                                          |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`                 | Yes                    | `false` for real providers; `true` for fixtures. Missing defaults to demo.                                                             |
| `SESSION_SECRET`            | Real mode              | Generate with `openssl rand -hex 32`. Use the same value across all serverless functions. Rotating it expires existing route sessions. |
| `ORS_API_KEY`               | Real routing           | Your openrouteservice/HeiGIT API key.                                                                                                  |
| `ORS_BASE_URL`              | Default supplied       | `https://api.openrouteservice.org`                                                                                                     |
| `GEOCODING_PROVIDER`        | Default supplied       | `geoapify` (the implemented adapter).                                                                                                  |
| `GEOCODING_API_KEY`         | Place search           | Your Geoapify key. Without it you can still select points on the map.                                                                  |
| `GEOCODING_API_URL`         | Default supplied       | Geoapify autocomplete endpoint from `.env.example`.                                                                                    |
| `INFRASTRUCTURE_FALLBACK` | `geoapify` | Use existing Geoapify key for limited real place evidence during Overpass outages; `none` disables it. Uses account credits; see docs/PROVIDERS.md. |
| `OVERPASS_API_URL`          | Default supplied       | Public Overpass interpreter or your own compatible service. No key required by the public default.                                     |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Default supplied       | OpenFreeMap Positron URL, or a MapLibre-compatible style URL.                                                                          |
| `NEXT_PUBLIC_MAP_API_KEY`   | Not used automatically | Reserved. If another map service requires a public key, insert its domain-restricted key in the style URL according to its docs.       |
| `NEXT_PUBLIC_SITE_URL`      | Deployment metadata    | Your final Vercel URL. Share links use the browser's actual origin.                                                                    |
| `GEMINI_API_KEY`            | Optional               | Google AI Studio API key. Missing/failure => deterministic summary.                                                                    |
| `GEMINI_MODEL`              | AI model               | Default `gemini-2.5-flash`; choose a structured-output model available to your account if that model is unavailable.                   |
| `DATABASE_URL`              | Live feedback only     | Neon **pooled** PostgreSQL connection string, including SSL settings.                                                                  |
| `DIRECT_URL`                | Migration setup        | Neon direct/non-pooled PostgreSQL connection string. Falls back to `DATABASE_URL` if absent.                                           |
| `UBER_CLIENT_ID`            | Optional               | Your approved Uber developer client ID, if available. No Uber secret or booking API is used.                                           |

`NEXT_PUBLIC_*` values are public and embedded at build time. Every other API key is used only by the server. Health configuration status is available at `/api/health`; it exposes booleans, not keys, and does not claim to test provider connectivity.

1. Create a [HeiGIT/openrouteservice account](https://account.heigit.org/) and obtain a directions key. Check your plan's alternative-route and directions quotas.
2. Create a [Geoapify project](https://myprojects.geoapify.com/) and obtain an API key. This app uses server-side autocomplete; configure restrictions appropriate for server requests. Do not use public Nominatim autocomplete.
3. Generate `SESSION_SECRET`, set those three secrets and `DEMO_MODE=false`.
4. Run `npm run dev`; search for a short urban journey. Requests are limited to endpoints 50 m–20 km apart and a bounded infrastructure-query area. Long/winding routes can exceed the query bound even within that endpoint distance.
5. Configure optional Gemini and Neon next. Planning continues without them.

No live credentials are included. Live ORS, Geoapify, Overpass, Gemini and Neon behavior must be smoke-tested with your accounts before launch; automated tests use fixtures and mocks.

## Neon feedback setup

1. Create a project at [Neon](https://neon.com/).
2. Copy its pooled connection string into `DATABASE_URL`, and direct string into `DIRECT_URL` in `.env.local`.
3. Apply the committed migration:

```bash
npm run db:migrate
```

4. With `DEMO_MODE=false`, finish a journey and submit feedback. Check the `journey_feedback` table in Neon's SQL editor.

`db:generate` is for developers changing the schema; do not generate a new initial migration during ordinary setup. The committed migration creates `journey_feedback`, `segment_observations` and `aggregate_segment_metrics`. Aggregates are reserved for a later moderated community feature and are **not** used to change scores. Optional segment observations are written in the same transaction as feedback. Unique submission and journey hashes reduce duplicate reports.

Stored location references are rounded to 0.01° cells (roughly kilometre scale), not precise paths. Free-text feedback can still contain identifying details; users are asked not to include them. There is no public individual-report endpoint. Configure retention and deletion operations before collecting public feedback at scale; retention is not automated in this MVP.

## Uber behavior — read before demonstrating

The official [Ride Request Deep Links](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction) document pickup and destination parameters. We did **not** find documented support there for `drop[0]` / `drop[1]`. SafarNav therefore does not invent or silently send those parameters.

- Pickup and final destination are encoded in a universal `https://m.uber.com/ul/` link.
- Intermediate candidates are only mapped public-access parking within 50 m of the selected driving route, away from its ends. Distinction from alternatives affects preference.
- A selected candidate requires explicit consent. In real mode, ORS verifies car reachability, proximity, detour and route overlap. These checks do not establish on-site stopping legality or available parking.
- A reviewed intermediate stop is **copied for manual entry in Uber**. The UI explicitly says it was not transmitted in the deep link. Add it before confirming a ride.
- Demo mode never opens a live Uber booking from fictional infrastructure.
- No booking, fare, driver tracking or trip-status API is integrated. Uber and the driver control routing. Opening Uber does not mark arrival.
- Test actual handoff on iOS Safari and Android Chrome with/without Uber installed. Desktop behavior and unsupported link handling depend on Uber; copyable destination, stop and SafarNav journey link remain available.

The share link contains the chosen endpoint coordinates and travel mode, not your location history, exact selected geometry or an active session. Recipients must calculate a fresh route. Share it only with people you intend to disclose the trip to.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

On a machine with Chrome installed, you can skip downloading Chromium:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Browser tests start a local production server if one is not running. Build first. They run desktop and mobile Chrome emulation with mocked GPS and exercise comparison, Time Machine, sections, summaries, monitoring, feedback, Uber consent and error states. Real Safari, mobile OS suspension, physical-device GPS, live provider quotas and real Neon persistence require manual checks. See [verification notes](docs/VERIFICATION.md).

See [the current deployment checklist](docs/DEPLOYMENT.md) for GitHub commands, real-mode variables and phone verification.

## Push this project to GitHub

Create an **empty** repository named `safarnav` on GitHub (do not initialize it with a README, licence or `.gitignore`, because those files are already here). Choose private or public deliberately. In your project terminal:

```bash
cd "/Users/karanbhura/CODING/VIHAAN X 9.0"
git init
git branch -M main
git add .
git status
```

Before committing, ensure `.env.local`, `node_modules`, `.next` and test reports are **not** listed. `git check-ignore .env.local` should show the filename once you have created it. Then:

```bash
git commit -m "Build SafarNav route planning app"
git remote add origin https://github.com/YOUR_USERNAME/safarnav.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Authenticate through GitHub's supported browser/credential-manager flow or personal access token; your GitHub password is not a Git-over-HTTPS password. Do not put tokens in remote URLs. If Git requests an identity, set your own name and email with `git config user.name` and `git config user.email`.

If macOS reports an unaccepted Xcode licence, open Xcode and personally review/accept it (or review it with `sudo xcodebuild -license` in your terminal). The project does not need Xcode to run, but Apple's developer-tool shims can require this setup. No licence was accepted by the assistant.

Later updates:

```bash
git add .
git commit -m "Describe your change"
git push
```

## Deploy on Vercel and view it live

1. Push the repository using the steps above.
2. Sign in to [Vercel](https://vercel.com/), choose **Add New → Project**, connect GitHub, authorize the specific repository and import `safarnav`.
3. Select **Next.js**. Root directory is the repository root, build command is `npm run build`, install command is `npm ci`. Leave output directory at the Next.js default. Select Node.js 24.x (or an available supported version ≥22).
4. Under Environment Variables, start with `DEMO_MODE=true` and `NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron`. This is enough for the public demo. Optionally set a generated `SESSION_SECRET` too.
5. For real mode, add `DEMO_MODE=false`, `SESSION_SECRET`, `ORS_API_KEY`, `GEOCODING_API_KEY` and the default provider URLs. Add Gemini, Neon and Uber settings only as needed. Add secrets through Vercel's encrypted settings, never through GitHub commits.
6. If using Neon, apply `npm run db:migrate` from your local terminal against the intended database **before** testing live feedback. Deployment does not automatically migrate your database.
7. Click **Deploy**. Open the supplied `https://…vercel.app` URL when the build succeeds.
8. Set `NEXT_PUBLIC_SITE_URL` to that URL and redeploy. Any changed `NEXT_PUBLIC_*` setting needs a rebuild. Ensure variables are assigned to the correct Production/Preview environments.
9. Check `/api/health`, then route search, scoring, Time Machine, map attribution, summary and feedback. Use a separate Neon branch/database for preview deployments that collect test feedback.
10. Future pushes to `main` trigger production deployments through the Git integration. Branch pull requests normally create previews. Do not enable public live-provider traffic without configuring appropriate provider budgets and Vercel firewall/rate protections.

No custom domain is required. HTTPS on Vercel supports browser geolocation. A site served over plain HTTP on a phone's LAN address may not have location access; use HTTPS for physical-device testing.

Official deployment references: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [builds and Git deployments](https://vercel.com/docs/builds), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables).

## Approval and account boundaries

Local file creation and checks are ordinary development work. This environment required permission for npm network access, building with worker processes, and local server/browser testing. Publishing, account connections, accepting provider terms, enabling paid services, supplying keys and applying migrations to your real database are separate setup actions. This build does not create third-party accounts, accept their terms, spend money, book rides, push to GitHub or deploy to Vercel.

## Architecture and limitations

See [architecture and scoring](docs/ARCHITECTURE.md), [provider terms and limits](docs/PROVIDERS.md) and [verification](docs/VERIFICATION.md).

The main next steps are real-account smoke tests, physical-device tests, a durable shared rate limiter/cache, better road-to-route map matching and measured performance under real infrastructure density. The heuristic weights are initial assumptions, not scientifically validated risk coefficients. No crime predictions, demographic proxies, live crowd levels or camera operation are inferred.
