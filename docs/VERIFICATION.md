# Verification record

Verified locally on **14 November 2026**, using Node 26.13.0, npm 11.20.0 and installed Google Chrome on macOS. Build uses Next.js 16.4.6 with webpack. This record describes actual executed checks, not a claim about unconfigured live services.

| Check                                                           | Result                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Dependency install                                              | Completed; lockfile included in the deliverable (not yet committed to Git).                                 |
| TypeScript (`npm run typecheck`)                                | Passed with strict mode.                                                                                |
| ESLint (`npm run lint`)                                         | Passed without warnings after excluding generated vendor workers.                                       |
| Unit/integration/component (`npm test`)                         | 41 passed across 6 files.                                                                               |
| Production build (`npm run build`)                              | Passed; all page and API routes compiled.                                                               |
| Browser journeys (`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`) | 6 passed: desktop and mobile Chrome emulation, in 12.9 seconds. |
| Schema generation (`npm run db:generate`)                       | Initial migration generated; follow-up reported no schema changes.                                      |
| Dependency audit                                                | Last install audited 681 packages and reported 0 known vulnerabilities.                                 |
| Credential scan                                                 | No real credentials or private-key patterns found in project source; only `.env.example` exists.        |
| Git availability                                                | Git 2.56.0 available. Repository not initialized or pushed; instructions supplied.                      |

## Coverage

- Weight totals, score clamps, true length weighting, mode differences, weak-run aggregation, confidence and deterministic ranking.
- Business closing, overnight schedules, weekdays, 24/7, missing/invalid/holiday schedules and passing-time evaluation in the POI timezone.
- Daylight differences and unknown lighting remaining uncertain.
- ORS response normalization and deduplication, malformed/infeasible route rejection, Overpass extraction/partial-response failure, Geoapify errors.
- Cache expiry, encrypted session tampering/expiry, input sizes, invalid coordinates, origin checks (including proxy URL normalization) and rate limits.
- Time Machine reuses geometry without provider calls.
- Gemini failures, nonexistent recommendations and added score fields trigger the deterministic fallback.
- Uber link endpoint encoding, explicit consent, invalid candidate rejection and honest manual-stop fallback.
- Feedback validation, demo non-persistence, mocked database writes with coarse cells, database failure recovery and discard.
- Keyboard autocomplete selection and poor-GPS alert suppression.
- Browser comparison, route selection, Time Machine, section details, summary, mocked-GPS start/pause/resume, arrival confirmation, feedback, Uber consent and provider error UI. Browser tests also assert map initialization and no horizontal mobile overflow.

## Browser findings resolved

1. Next.js normalized the internal request URL to localhost while the browser used 127.0.0.1. The origin check now compares the incoming Host authority; regression test added.
2. MapLibre 6 requires an external ESM worker. `predev` / `prebuild` copy the installed version's worker assets to an ignored public directory and the map sets its worker URL explicitly.
3. Mobile map fitting now reserves space above the bottom sheet; results scroll into view after a comparison.
4. Autocomplete supports arrow-key navigation and Enter selection.

Screenshots were visually inspected on desktop and Pixel 7 emulation. Screenshots and Playwright traces are ignored local artifacts in `test-results/`. The in-app computer-preview tool was unavailable/stalled; Playwright supplied working browser verification instead.

## Performance observations

The webpack production compilation took about 5 seconds in the final local build (not total deployment time). The six browser scenarios took about 13 seconds in an earlier successful run. These are machine-specific development measurements, **not** Core Web Vitals, mobile-network latency or production throughput claims. Live provider latency and dense-area spatial processing were not benchmarked. Geometry evaluation is bounded but uses linear scans; a spatial index is an appropriate improvement for dense datasets.

## Requires your accounts or physical devices

- ORS directions/alternatives and quota behavior with a real key.
- Geoapify key restrictions and autocomplete in the deployed environment.
- Live Overpass responses, area coverage and mapped schedule reliability.
- Available Gemini model and structured responses under your account quotas.
- Applying migrations and verifying actual Neon inserts/transactions. Database tests mock the adapter; they are not a live database test.
- Real iOS Safari and Android Chrome GPS accuracy, permission denial/revocation, screen lock, page suspension, and real Uber handoff. Browser emulation does not establish device-level support.
- Public deployment, shared rate limiting/firewall policy, feedback retention, provider budgets and production load.

No GitHub repository was created, no remote push was made, no Vercel deployment was performed, no paid accounts were enabled, and no ride was booked.

## Infrastructure request repair

Reproduced HTTP 406 against the configured Overpass endpoint using the previous stock Node.js request headers. Added a SafarNav User-Agent, JSON Accept, coalescing, serialized requests, and rejection cooldown handling. Regression tests cover request headers, custom identity, HTTP 406/429 cooldowns and concurrency. The first live check with the updated adapter returned HTTP 502; a further network retry was declined. Successful live infrastructure scoring remains unverified for this repair. The opt-in live smoke test is skipped during normal tests. No user keys, personal journey coordinates or database writes were used in the live check.

## Infrastructure outage follow-up

The primary public Overpass endpoint and a separately tested public instance timed out even for tiny fixed-area requests. Neither endpoint was silently rotated in application configuration. Added a Geoapify Places fallback using the already configured key, bounded queries and explicit partial-coverage messaging. The opt-in live Geoapify smoke test passed on a fixed public New Delhi area, returning real places and an infrastructure-backed score; this does not verify full Overpass coverage or the user's exact route. Corrected the clinic category to the provider's documented `healthcare.clinic_or_praxis` during that check.

54 unit/component tests passed (two opt-in live checks skipped in the default suite); ESLint, TypeScript and the production build passed. Missing evidence now suppresses displayed neutral scores and safety recommendations while keeping directions available. Added browser regression coverage for that state.

All 10 desktop/mobile browser tests also passed, including infrastructure outage behavior and light/dark contrast checks. Browser tests used demo fixtures and intercepted failure responses; they do not assert live-provider availability.

## Summary, navigation handoff and notifications

66 automated tests passed, including configured Gemini success, API failure fallback, rejected summary wording, Google Maps waypoint construction and strict below-30 alert eligibility. Production build, lint and TypeScript passed. Browser coverage checks driving-first/default selection, clean summary output, the visible Google Maps feature and journey-button contrast in both themes. Gemini behavior was tested with a mocked SDK; no claim of a live account call is made. Platform notifications and Google Maps' actual recalculated directions require physical-device verification after deployment.

The shareable `.env.example` was found to contain credentials and was cleared before Git initialization; `.env.local` was left unchanged. Source/docs/public credential-pattern checks reported no matching literals. No GitHub push or Vercel deployment was performed.
