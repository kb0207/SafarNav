# Architecture and scoring

## Request flow

The Next.js App Router renders the page and serves Node.js route handlers. The client lazily imports MapLibre and maintains a single map instance. Stable GeoJSON sources receive updated routes, weak sections, POIs, location and GPS accuracy. Search and rescoring requests are debounced and cancelled when superseded.

`POST /api/routes` validates two places, a mode and a departure time, requests up to three ORS alternatives, removes substantially overlapping geometries, batches a bounded Overpass query over their combined area, normalizes infrastructure and calculates scores. Infrastructure failure produces explicit warnings and neutral missing-data contributions, never fictional replacements. Demo mode is an explicit server setting; no live error silently becomes demo data.

A compressed AES-256-GCM encrypted snapshot carries the provider-derived routes and infrastructure with a one-hour expiry. Its key is derived from `SESSION_SECRET`. This permits rescoring across serverless cold starts without a journey database. `/api/routes/rescore`, `/api/ai/route-summary`, `/api/uber/link` and `/api/feedback` authenticate the snapshot. They do not accept client-supplied scores as truth. Tokens stay in React memory and are never put in share URLs or local storage. In default demo mode the public demo key is not a security boundary: decoded input is replaced by canonical demo fixtures. Real mode requires a private session secret.

Snapshots can be sizable; POST bodies are streamed with a 2 MB limit and decompression is capped at 8 MB. This is suitable for bounded urban demo/MVP journeys, not unbounded regional routing. Query limits, feature limits and API rate limits constrain CPU and provider costs.

## Modules

- `src/lib/providers`: ORS, Geoapify, Overpass normalization and deterministic demo fixtures.
- `src/lib/geo`: metre-based Turf geometry, projection, slicing, route overlap and GPS matching.
- `src/lib/scoring`: weights, opening-hour evaluation and deterministic engine.
- `src/lib/services.ts`: planning and rescoring orchestration.
- `src/lib/session.ts`: authenticated encrypted route snapshots.
- `src/lib/http.ts`: validation, request limits, origin policy, errors and provider timeouts.
- `src/lib/cache`: bounded TTL cache interface and process-local implementation.
- `src/lib/ai`: structured Gemini response validation and deterministic fallback.
- `src/lib/uber`: public parking candidate selection, consent, routing checks and supported deep link.
- `src/lib/db`: Neon HTTP/Drizzle schema and transactional feedback persistence.
- `src/components`: map, planner, search, trip monitoring and feedback.

## Scoring model

These are **heuristics, not validated risk coefficients**. There is no crime model or use of neighborhood demographic identity.

| Factor                        | Walking | Driving |
| ----------------------------- | ------: | ------: |
| Activity                      |      20 |       8 |
| Lighting                      |      22 |      12 |
| Road classification           |      12 |      28 |
| Isolation proxy               |      18 |       8 |
| Emergency/support proximity   |      10 |      10 |
| Transit proximity             |       5 |       2 |
| Explicit surveillance mapping |       3 |       2 |
| Mode suitability              |      10 |      30 |

Each route is split at approximately 150 m intervals using true line slicing. Routes longer than 75 km use at most 500 sections, though request limits ordinarily keep journeys much shorter. Each factor is clamped to 0–100. Section scoring uses only known factors: their weighted mean minus half the weighted shortfall below 40. There is no neutral prior. Missing evidence is not a negative observation. The score ceiling is `60 + 0.4 × known factor weight`; isolated positive evidence cannot produce an 80. Known mode suitability at 10 or below caps the section at 25, so nearby shops cannot compensate for a mode-incompatible road. Completely unknown sections retain an internal placeholder and cannot establish an assessment.

Route score = 65% of the length-weighted observed-section mean + 35% of the length-weighted worst 20% of observed route length. Fractional boundary sections are included precisely. Route scores are also capped at `60 + 0.4 × overall confidence`, where overall confidence includes unobserved route length. This penalizes bottlenecks without inventing negative evidence for unmapped sections. A route requires known infrastructure factors, not just a business with unknown hours or astronomical daylight, to display an assessment. These coefficients are conservative engineering heuristics, not calibrated probabilities of personal safety. Calculations retain precision; the UI rounds only presentation values.

Ranking is descending route indicator, then duration, then stable ID. There is **no additional hidden ranking penalty**. Weak sections are strictly below 35/100. The UI exposes the minimum section score, section count, total weak metres and longest continuous weak run separately.

### Evidence and normalization

- Businesses are considered within 100 m for walking or 180 m for driving, measured against route geometry. Their nearest along-route position estimates passing time by the fraction of route length × provider duration. This assumes uniform speed, not traffic forecasts or per-edge travel times.
- Business coordinates rounded to 0.0001° are deduplicated within a section. Expected-open activity uses `100 × (1 − exp(−openCount / 2))`. Known-closed businesses get **zero open activity credit**. Unknown-only or missing business data gets 50 (uncertain), not fabricated open/closed status. Mapping completeness remains unknown.
- Isolation uses the same local expected-open evidence: no expected-open businesses in a sample with known schedules gives 20; otherwise at least 30 with activity saturation. Missing schedule evidence is neutral. Consecutive low total-score sections form weak stretches. This is a low-activity proxy, not a verified deserted area.
- Lighting uses the nearest road's explicit `lit=yes/no` within 25 m and mapped lamps within 40 m. At night: mapped lit = 90, explicit unlit = 10, missing = 50. Estimated daylight from SunCalc gives 90, reducing dependence on artificial light. Missing lamps never prove darkness. Mapped operation is not verified.
- Road classification and access use a nearest-road proximity match within 25 m. Pedestrian roads, sidewalks, residential roads, heavy roads and restrictions have distinct mode-specific values, visible in the engine. Restricted roads receive zero road/suitability credit, not a reward. ORS establishes actual routed feasibility; the nearby OSM road match does not replace network-level access validation.
- Emergency/support features use 400 m proximity and saturate at 90. Missing facilities are neutral. Presence does not establish staffing, access or availability.
- Transit presence gives 75. Explicit camera records within 60 m contribute 50 + 40 × (1 − exp(−count / 2)) to a section; guards and unspecified surveillance types do not count as cameras. Distribution affects the distance-weighted route score, so a cluster does not imply route-wide coverage. Camera summaries show unique mapped locations, the union of nearby along-route intervals and the largest gap. These approximate proximity intervals are not camera fields of view. Missing mapping remains unknown. Neither transit nor cameras imply verified operation.
- Confidence = distance-weighted percentage of factor weights supported by available evidence. This is internal only: the frontend and route summary do not display confidence labels or percentages. It measures evidence coverage, **not probability of safety**. Retrieval timestamps are displayed, but OSM edit recency/completeness are not independently validated or assigned precise decay curves.

Thresholds and weights are centralized in `src/lib/scoring/config.ts`; engine normalization thresholds are documented above. Extend them only with tests and a review of their assumptions.

## Time and schedules

Timezone is inferred from each POI coordinate via `tz-lookup`; `date-fns-tz` supplies local wall-clock time to the `opening_hours` parser. The parser handles weekdays, overnight spans and ordinary opening schedules. Invalid/missing schedules remain Unknown. Public/school-holiday rules remain Unknown because reliable regional calendars are not integrated. This deliberately avoids guessing holiday closures. Opening hours are predictions based on mapping, never real-time confirmations. Solar conditions use actual timestamp and geographic coordinates.

## Provider caching and rate limits

Route geometries and place queries: 5 minutes. Infrastructure: 30 minutes. AI explanations: 15 minutes, keyed by a hash of computed facts and departure. Each process cache has at most 200 entries and never labels a stale entry as live. Snapshots expire after one hour and retain their original fetched timestamp. Provider requests have timeouts and retry a transient failure once (no uncontrolled retry loop).

Rate limiting is process-local, with endpoint-specific budgets. Origin checks reject cross-origin browser submissions. Neither is authentication against a determined non-browser attacker. Multiple Vercel instances do not share cache or counters. Before broad public traffic, add a durable limiter/cache (for example a managed Redis service) or enforce limits at the Vercel firewall, with provider account quotas and budgets. Do not claim this MVP limiter is distributed abuse protection.

## Trip monitoring and privacy

GPS is requested only after explicit interaction, smoothed lightly when accuracy is low, and kept in memory. Route matching estimates progress and off-route distance. Accuracy over 100 m suppresses weak-section alerts; off-route detection uses the larger of 60 m or twice reported accuracy. Approaching-section alerts target scores strictly below 30 and occur within 250 m and are deduplicated per section. Pause, discard, arrival and unmount clear the geolocation watch. Hidden pages stop monitoring and resume on foreground return. Background GPS continuity is not promised.

Anonymous feedback uses a unique submission UUID and a hash of the expiring route session. It stores coarse geographic cells and answers, with optional coarse section observations. It does not store route geometry, raw location history, names or identifiers by default. Aggregation tables are reserved and not exposed or used in scores. Live database migrations and retention policy are operator responsibilities.

## Deliberate scope limits

- No live traffic, crime feeds, crowds, sensor lighting or operational camera data.
- No exact road-to-route map matching or POI entrance/connectivity graph; proximity is labelled as such.
- No public holiday calendar inference.
- No guaranteed safe stopping place; only mapped candidate and routing checks plus user judgment.
- No verified Uber multi-drop deep link; intermediate stops use explicit manual entry.
- No offline routing, background location service, turn-by-turn voice instructions or Uber driver telemetry.
- Shared links reproduce endpoint requests, not identical future route choices.
- No automated community moderation/aggregation or retention scheduler.


## Summary and handoff presentation

A configured Gemini key is used for summaries, including labelled demo facts; unavailable or rejected responses use the computed fallback. Both formats omit confidence, threshold and caution fields. Confidence remains internal to scoring. Google Maps receives an interior waypoint selected for separation from alternative routes; this cannot lock Google’s route geometry. Start journey requests optional notification permission and displays service-worker notifications for upcoming sections below 30, with in-page alerts when permission or platform support is absent. Foreground GPS is required.
