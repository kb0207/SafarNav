# CODEX MASTER BUILD PROMPT — SAFARNAV

## 0. Your role and primary objective

You are a senior full-stack engineer, geospatial systems developer, UI/UX designer, data engineer, and technical architect.

Build a complete, functional, production-minded web application named **SafarNav** in the current local project directory.

Tagline: **"Not just the shortest route. The safer one."**

SafarNav is a safety-focused navigation platform designed especially for people travelling alone. It compares multiple feasible routes between an origin and destination, evaluates publicly available geographic and infrastructure data, calculates an explainable safety score out of 100, and ranks the routes accordingly.

The app must account for changing conditions based on the user's intended travel time and transport mode.

It must also support an AI-powered route explanation, a Time Machine slider, Uber ride handoff with an optional intermediate stop, alerts for weaker route sections, and post-journey feedback.

This is a real hackathon project. Build functional software, not a static demonstration.

### Core requirements

1. Develop and run the project locally.
2. Make the entire project GitHub-ready.
3. Make the web app deployable to Vercel.
4. Use Neon PostgreSQL where persistent storage is necessary.
5. Prioritize low latency, responsiveness, mobile usability and reliable integrations.
6. Use actual geographic data wherever possible.
7. Make every safety score mathematically explainable.
8. Treat missing data honestly and never invent safety infrastructure.
9. Use Gemini API for AI-powered explanations, not for inventing numerical safety scores.
10. Deliver a usable end-to-end product, with tests and setup documentation.

Do not stop after creating the frontend. Implement the backend, providers, scoring logic, interaction flows, data handling and required tests.

Do not make unnecessary changes outside this project directory.

---

## 1. Recommended technology stack

Use the following unless there is a compelling technical compatibility reason to adjust something:

### Frontend

- Next.js with App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui components where appropriate
- Lucide icons
- MapLibre GL JS
- Responsive, mobile-first design
- Progressive Web App support where feasible

### Backend

- Next.js Route Handlers running on Node.js
- TypeScript service modules
- Zod for request and response validation
- Modular services and provider adapters
- Server-side integrations with external APIs

### Geographic infrastructure

- OpenStreetMap data
- openrouteservice for alternative route calculation
- Overpass API for geographic infrastructure and POIs
- Configurable geocoding provider
- MapLibre-compatible map tile/style provider
- Turf.js for geometry calculations
- An appropriate timezone lookup library
- `opening_hours` JavaScript library to interpret OSM business schedules

### Database

- Neon PostgreSQL
- Drizzle ORM and migration tooling, if persistence is implemented

### Artificial intelligence

- Official Google GenAI JavaScript SDK: `@google/genai`
- Gemini model configurable by environment variable
- Structured JSON output with schema validation

### Quality and deployment

- Vitest for unit tests
- React Testing Library for component testing
- Playwright for important browser journeys
- ESLint and TypeScript checks
- Vercel-ready configuration
- `.env.example`
- A complete README
- build a .gitignore file as well and put necessary items that need to be protected

Prefer stable, actively supported package versions compatible with the installed environment. Verify current APIs and avoid deprecated integrations.

---

## 2. Core product workflow

Implement the following main user journey.

### Step 1: Enter a journey

The user opens SafarNav and sees an interactive map and simple route-planning interface.

They can:

- Enter a starting location.
- Enter a destination.
- Select their current location as the origin.
- Select locations directly on the map.
- Swap starting and destination locations.
- Choose Walking or Driving.
- Choose travel time, defaulting to now.

The application should offer searchable place suggestions using a suitable geocoding provider.

Do not implement autocomplete against the public OpenStreetMap Nominatim endpoint, which prohibits that usage. Use a compatible geocoding service or another properly hosted solution.

### Step 2: Calculate routes

After the user selects an origin, destination and travel mode:

1. Validate the locations.
2. Send a routing request to the backend.
3. Retrieve up to three meaningfully different feasible routes.
4. Draw the routes on the map.
5. Fetch relevant mapped infrastructure near their geometries.
6. Calculate the safety score of each route.
7. Rank available routes from highest to lowest safety score.
8. Show distance, travel duration, estimated arrival and safety score.
9. Explain the principal reasons for the ranking.
10. Allow the user to select any route.

Do not assume that the shortest route is the safest route.

If the routing provider returns fewer than three routes, show only the available routes. Never invent alternatives.

### Step 3: Select a route

When a route is selected:

- Highlight its geometry on the map.
- Display its score and confidence level.
- Show its score breakdown.
- Display identifiable supportive POIs.
- Highlight weaker route segments.
- Display travel time and distance.
- Offer an AI-powered explanation.
- Offer navigation/trip monitoring.
- Offer Uber handoff in Driving mode.

### Step 4: Complete a journey

After the user indicates arrival:

- End active location monitoring.
- Offer an optional feedback form.
- Provide a way to discard the journey without saving it.

---

## 3. Mapping and geographic data integrations

### 3.1 OpenStreetMap

**Purpose:** Provide geographic road-network information, infrastructure and points of interest.

Use OSM-derived data for:

- Road classifications
- Road access and connectivity
- Pedestrian paths and sidewalks when available
- Shops and pharmacies
- Restaurants and cafés
- Hospitals and clinics
- Police stations
- Fuel stations
- Metro and railway stations
- Public transport stops
- Street lighting tags and mapped street lamps
- Publicly mapped surveillance equipment

Do not confuse OSM's geographic database with a routing API.

Always display required OpenStreetMap attribution.

### 3.2 Routing using openrouteservice

Create a routing provider service that can:

- Receive origin and destination coordinates.
- Distinguish between Walking and Driving.
- Request alternative routes.
- Return route geometry as GeoJSON-compatible data.
- Return distance, duration and routing metadata.
- Report whether a route is feasible.
- Handle disconnected roads, invalid locations and provider failures.

Use supported profiles:

- `foot-walking`
- `driving-car`

Use the provider's documented alternative-route functionality where supported.

Deduplicate routes that substantially overlap, because displaying three nearly identical routes is not useful.

Keep provider configuration, keys and API-specific details isolated in a routing adapter.

Implement appropriate rate limiting, timeouts and retries.

Do not call the routing provider again whenever the user changes the Time Machine slider if route geometries have not changed.

### 3.3 MapLibre GL JS

**Purpose:** Display and interact with the geographic map.

Implement:

- Interactive zooming and panning
- Origin and destination markers
- User-location marker with accuracy indicator
- Different route colors
- Selected-route emphasis
- POI markers
- Weak-segment overlays
- Route popups
- Optional map legend
- Route bounds fitting
- Mobile touch interactions
- A recenter-on-location control
- A map style that is usable in both light and dark UI themes

Do not create a new map instance on every React render.

Use stable map sources and layers, updating GeoJSON data when route selection or scores change.

Lazy-load heavy map modules on the client.

Use a configurable, production-appropriate map style and tile provider.

### 3.4 Points of interest using Overpass API

Build an infrastructure data service that queries relevant features along the candidate routes.

Support OSM tags including, where appropriate:

- `shop=*`
- `amenity=pharmacy`
- `amenity=restaurant`
- `amenity=cafe`
- `amenity=hospital`
- `amenity=clinic`
- `amenity=police`
- `amenity=fuel`
- `railway=station`
- `station=subway`
- `public_transport=*`
- `highway=bus_stop`
- `highway=street_lamp`
- `lit=*`
- `man_made=surveillance`

Classify returned features into normalized categories.

Preserve source identification and available metadata.

Include:

- Geographic coordinates
- OSM feature identifier
- Name when available
- Feature category
- Opening-hours data when present
- Applicable lighting attributes
- Available source metadata

Query infrastructure for a buffered area surrounding the candidate route network. Avoid calling Overpass for every individual route point.

Batch nearby queries and cache shared results.

Recognize that public Overpass servers have resource and usage limitations. Implement graceful failure and configurable provider URLs.

Do not display outdated cached POI information as live data.

### 3.5 POI relevance

Not every POI in the route's bounding box is relevant.

Use geometry calculations to determine whether a POI lies within an appropriate distance of the route, using distance to route geometry rather than distance to a single marker.

Make the buffer configurable by POI category and travel mode.

Illustrative defaults:

- Walking: closer proximity should receive more importance.
- Driving: relevant facilities may be considered over a wider area.
- Emergency infrastructure: may use a different relevance radius from shops.

A POI that is geographically close but inaccessible from the route must not automatically be treated as usable. Where feasible, check access and connectivity; otherwise label this as proximity only.

Avoid counting duplicates.

---

## 4. Dynamic business opening hours

This is a critical feature.

SafarNav must evaluate whether businesses are expected to be open when the traveller actually passes them.

### Required algorithm

1. Fetch the business's `opening_hours` value from OSM.
2. Parse the schedule using a proper opening-hours parser.
3. Determine the expected time at which the user will reach the business.
4. Evaluate the opening schedule at that predicted time.
5. Categorize the business as:
   - Open
   - Closed
   - Unknown
6. Use this status in the route's activity score.

### Predicted arrival time

Do not check every business solely against the time the user opens the web app.

For each relevant POI:

- Determine its closest position along the route.
- Calculate approximate cumulative travel time from the origin to that position.
- Add cumulative travel time to the user's departure datetime.
- Evaluate the POI at that predicted datetime.

Example:

A user starts a trip at 9:30 PM.

A pharmacy is located 15 minutes along the route.

The pharmacy closes at 9:40 PM.

It should not count as an expected open pharmacy, because the traveller will pass it at approximately 9:45 PM.

Handle:

- Different weekdays
- Weekends
- Overnight opening hours
- 24-hour facilities
- Times crossing midnight
- Timezones
- Supported public-holiday rules
- Invalid opening-hours syntax
- Unknown business hours
- Potentially stale business information

If there is no valid schedule, classify status as Unknown.

Never treat Unknown as definitively Open or Closed.

Avoid assuming that an open business guarantees people will be present.

### User interface

Allow users to tap a POI to inspect:

- Name
- Category
- Expected status at passing time
- Estimated passing time
- Available opening-hours information
- Data source

Use labels such as "Expected open" rather than falsely claiming real-time confirmation.

---

## 5. Safety scoring engine

Build a transparent, deterministic, extensible scoring engine.

**Every route must receive a safety indicator from 0 to 100.**

The number represents a relative infrastructure-based safety assessment, not a guaranteed probability of personal safety.

The AI must not independently invent, modify or override this score.

### 5.1 Segment the route

Divide each route into approximately 100–200-meter segments, adjusting for route length and vertex geometry.

For each segment, calculate individual safety-related features.

Examples:

- Open businesses nearby
- Known street lighting
- Road classification
- Proximity to transport infrastructure
- Nearby emergency facilities
- Potentially isolated stretches
- Publicly mapped surveillance
- Pedestrian suitability or drivable-road suitability

Maintain data and confidence metadata for every segment.

Use Turf.js and appropriate geometry operations.

### 5.2 Configurable category weights

Start with this proposed weighting scheme.

| Factor | Walking | Driving |
|---|---:|---:|
| Active businesses and public activity | 20% | 8% |
| Lighting infrastructure | 22% | 12% |
| Road classification and visibility proxies | 12% | 28% |
| Isolated or low-activity stretches | 18% | 8% |
| Emergency/support infrastructure | 10% | 10% |
| Public transport accessibility | 5% | 2% |
| Publicly mapped surveillance | 3% | 2% |
| Pedestrian or vehicle route suitability | 10% | 30% |
| **Total** | **100%** | **100%** |

Store these weights as typed configuration, not repeated hardcoded values.

Validate that the weights for each travel mode total 100.

Allow future modification without rewriting the scoring engine.

These are initial heuristic weights, not scientifically validated risk coefficients. Document their assumptions.

### 5.3 Normalize factors

For every factor:

- Produce a normalized score from 0 to 100.
- Apply its applicable weight.
- Record the evidence behind the score.
- Track whether data is known, estimated or missing.

Use deterministic normalization functions with documented thresholds.

Avoid simple raw POI counting that rewards longer routes merely because they contain more businesses.

Use normalized density, proximity, segment coverage and other length-adjusted quantities.

### 5.4 Activity score

Prioritize relevant active facilities.

An expected-open shop contributes more evidence of potential street activity than a known-closed shop.

However:

- One shop must not overwhelm the model.
- Multiple businesses in the same building should not be overcounted.
- Missing opening hours must not imply that a place is open.
- A restaurant's existence alone does not prove an area is currently busy.
- Avoid unfair assumptions based solely on neighborhood identity.

Use a smooth saturation function for business density rather than unlimited accumulation.

### 5.5 Lighting score

Use direct lighting tags where available:

- `lit=yes`
- `lit=no`
- Mapped street lamps
- Other documented lighting attributes

Consider time of day and locally calculated sunrise/sunset.

At daytime, reduce the importance of artificial lighting without excluding other indicators.

Do not interpret the absence of a streetlight in OSM as proof that no streetlight exists.

When mapped lighting coverage is unavailable, assign a neutral or appropriately uncertain contribution and lower the confidence score.

Clearly distinguish:

- Known lit
- Known unlit
- Unknown lighting

### 5.6 Road classification score

Use OSM road classes and access information.

Consider:

- Primary/secondary roads
- Residential roads
- Service roads
- Pedestrian paths
- Footways
- Access restrictions
- Sidewalk availability where mapped
- Walking/driving compatibility

Larger roads must not automatically receive maximum safety points.

For walking, pedestrian access, sidewalks, crossings and reasonable road conditions matter.

For driving, legal access and suitable road connectivity matter.

Do not reward an inaccessible road.

### 5.7 Isolation and weak gaps

Detect consecutive stretches with relatively little supporting infrastructure.

Use:

- Distance between relevant active POIs
- Length of low-activity stretches
- Lighting evidence
- Road classifications
- Nearby supporting facilities

Identify meaningful stretches, not random isolated pixels.

If there is insufficient lighting data, do not label a street "dark" with certainty.

Use "Potentially isolated stretch" or "Limited lighting data" as appropriate.

### 5.8 Emergency infrastructure

Consider mapped:

- Hospitals
- Clinics
- Police stations
- Fuel stations
- Other relevant emergency or support POIs

Use geographic proximity as a limited indicator.

Do not assume that an emergency facility is open, accessible, staffed or capable of providing a specific service without supporting data.

### 5.9 Surveillance

Consider surveillance cameras only where explicitly mapped through legitimate public data.

Do not assume a camera is operational or actively monitored.

Treat this as a low-weight indicator.

Never invent camera coverage from surrounding business density.

### 5.10 Segment score calculation

For each segment, calculate a weighted factor score.

Conceptually:

SegmentScore = Sum(FactorScore × ModeWeight) / 100

Clamp to [0,100].

Make the formula and all factor contributions inspectable in tests and development tooling.

When factor data is unavailable:

- Do not treat it as verified safe.
- Do not automatically treat it as verified dangerous.
- Use an explicit neutral/uncertain scoring policy.
- Reduce the data-confidence estimate.

### 5.11 Route score calculation

Calculate the overall route score as a distance-weighted mean of its segment scores.

Conceptually:

RouteScore = Sum(SegmentScore × SegmentLength) / TotalRouteLength

Use actual segment lengths and avoid rounding until presentation.

Round the displayed result to the nearest integer.

Add a secondary weakest-section metric so that a route containing a very concerning stretch is not disguised by otherwise stronger segments.

Present:

- Overall score
- Lowest segment score
- Number of weak segments
- Total length of weak stretches
- Longest continuous weak stretch
- Data confidence

If appropriate, use a configurable modest risk penalty when ranking routes containing sustained low-scoring stretches.

Ensure the penalty is documented, deterministic and tested.

### 5.12 Data confidence

Calculate a separate confidence percentage.

It should reflect:

- Coverage of key infrastructure attributes
- Availability of opening-hours data
- Source recency when known
- Availability of road classifications
- The proportion of neutral estimates and missing information

Do not confuse confidence with safety.

Display statements such as:

"Safety indicator: 74/100 — Data confidence: Moderate"

Never suggest that 74/100 means a 74% probability of being safe.

If critical evidence coverage is very low, display an "Insufficient data" warning even when a numerical estimate can be calculated.

### 5.13 Route ranking

Rank routes primarily by the defined safety indicator, respecting data-confidence warnings.

Display three route cards when three meaningful alternatives exist:

- Highest safety score
- Fastest feasible route, if different
- Other alternative

These are descriptive labels, not a requirement to invent three categories.

Show:

- Safety score
- Confidence
- Distance
- Duration
- ETA
- Additional time versus the fastest route
- Weak sections
- Main supporting reasons

For example:

"Route A scores 78/100 and takes 24 minutes. Route B scores 61/100 and takes 19 minutes. Route A has stronger mapped lighting coverage and fewer low-activity stretches, adding five minutes."

Use real computed numbers, never hardcoded examples in the live interface.

---

## 6. Time Machine

Create a prominent feature named **Time Machine**.

### Core concept

Users should be able to see how the calculated safety conditions of their journey change with departure time.

For example, a road with active businesses at 6 PM may have fewer expected-open businesses at 11 PM.

### UI

Implement:

- A horizontal, touch-friendly time slider
- Default position: current local time
- Labels with readable time
- Steps of 15 or 30 minutes
- A 24-hour forward planning window
- Clear indication of date changes after midnight
- A reset-to-now button

Display the selected departure date and time.

Optional: include a play button to animate changes across the 24-hour period without creating excessive network traffic.

### Functionality

When the slider changes:

1. Reuse the cached route geometry.
2. Reuse relevant cached POI and infrastructure data.
3. Recompute expected arrival times along each route.
4. Re-evaluate applicable business opening hours.
5. Re-evaluate time-dependent lighting factors.
6. Recompute segment scores.
7. Recompute route scores and confidence.
8. Update the route comparison.
9. Update weak-section highlighting.
10. Show any change in route ranking.

Time Machine must actually update the scoring calculations, not just change the clock displayed on the screen.

### Performance

- Debounce or throttle slider changes.
- Keep calculations deterministic.
- Avoid refetching route geometry.
- Avoid calling Gemini for every slider movement.
- Consider memoization or Web Workers if calculations become computationally intensive.
- Update map layers efficiently.

Ensure the slider works smoothly on touchscreens.

---

## 7. AI-powered route summaries using Gemini

Gemini will power SafarNav's explanation layer.

**Gemini must explain computed evidence, not create unsupported safety facts or assign scores.**

### API integration

Use Google's official supported SDK.

Store the Gemini API key server-side in an environment variable.

Never expose the secret to the browser.

Implement a dedicated backend endpoint, such as:

`POST /api/ai/route-summary`

### Input

Send a compact structured payload containing:

- Transport mode
- Selected departure time
- Routes and their IDs
- Calculated safety scores
- Confidence levels
- Distances
- Durations
- Key supporting factors
- Key weaknesses
- Relevant POI summaries
- Missing data warnings
- Time-dependent differences

Avoid sending raw precise user location histories or unnecessary personal information.

### Response

Request structured JSON with fields such as:

- `recommendedRouteId`
- `headline`
- `whyRecommended`
- `comparison`
- `importantCautions`
- `dataLimitations`

Validate the generated JSON using Zod.

### Requirements

- Use clear, concise, human-friendly wording.
- Compare available routes fairly.
- Explain the trade-off between safety indicator and journey duration.
- Mention weak stretches when relevant.
- Distinguish known facts from estimates.
- Avoid exaggerated certainty.
- Avoid unsupported claims about crime, dangerous people or guaranteed outcomes.
- Never recommend a nonexistent route.
- Do not change any calculated number.

An example explanation structure:

"Route A is the stronger option based on available infrastructure data. It has more expected-open businesses and better mapped lighting coverage, although it takes five minutes longer than Route B. A low-activity stretch remains near the final part of the journey."

### Performance and reliability

- Call Gemini only when needed.
- Gemini will only summarise the route when a button is clicked that says "View Summary".
- Cache summaries by a fingerprint of route facts and selected time.
- Limit output length and token usage.
- Apply timeouts and safe error handling.
- Provide a deterministic, template-based explanation if Gemini fails.

The app must remain usable without a Gemini key.

An unavailable AI service must never prevent navigation or scoring.

---

## 8. Uber integration with optional intermediate stop

This is an important differentiating feature.

### The problem

SafarNav may identify a relatively safer route, but Uber's own routing system might select a different road.

We want to allow the user to add an intermediate stop located on the selected SafarNav route to encourage Uber's trip to pass through that area.

### Critical limitations

Do not claim that SafarNav can force Uber to follow an exact street-by-street path.

An intermediate stop can influence routing, but Uber and the driver control the final route.

Additional stops may affect price and journey time.

Uber booking and app handoff should remain under the user's control.

### Required functionality

Display an option in Driving mode:

"Open this route in Uber"

Before handoff:

1. Display the chosen route.
2. Explain that Uber may follow a different path.
3. Ask the user whether to include a suggested intermediate stop.
4. Only add the stop after affirmative consent.

### Automatic intermediate-stop selection

Create a deterministic waypoint-selection algorithm.

It should:

- Examine the chosen driving route.
- Identify useful candidate locations along the route.
- Prefer legally accessible, practical stopping points.
- Favor a waypoint that meaningfully distinguishes the chosen route from competing routes.
- Avoid highways or locations where stopping is unsafe or prohibited.
- Avoid private/inaccessible areas.
- Avoid selecting a point too close to the origin or destination.
- Minimize unnecessary detour distance.
- Avoid unreasonable or unavailable stopping areas.

Where a safe and valid intermediate stop cannot be identified, do not invent one.

Allow the user to review and change or remove the candidate.

Verify that the stop is reachable by car. Recalculate the route with the stop and check whether the resulting geometry reasonably matches the original selected route.

### UI preview

Show:

- Pickup location
- Optional intermediate stop
- Final destination
- Selected route geometry
- Approximate total distance
- Estimated journey duration from SafarNav's routing provider
- Estimated extra time caused by the stop
- A disclaimer about Uber's actual routing and fare

Clearly label SafarNav's ETA as its own estimate, not an Uber fare or Uber arrival estimate.

### Uber deep linking

Follow Uber's currently supported official Ride Request Deep Link documentation.

Use a mobile-web-compatible universal link, where supported.

Pass:

- Pickup coordinates and available address
- Intermediate stop as the first drop location
- Final destination as the final drop location
- Required developer/client identifiers, where applicable

Use the documented multiple-drop format such as `drop[0]`, `drop[1]` where supported.

Properly encode the location objects and URLs.

Test actual behavior on both iOS and Android.

Support:

- iPhone with Uber installed
- Android with Uber installed
- Mobile browser fallback
- Desktop handling
- Link failures
- Missing Uber developer configuration

The user should arrive at the appropriate Uber ride-request experience with supported trip fields prefilled.

**Do not automatically confirm or purchase a ride.**

### Fallback

If a platform does not accept the full stop sequence:

- Explain the limitation.
- Preserve the trip in SafarNav.
- Provide a copyable intermediate stop and destination.
- Provide a shareable SafarNav route link.
- Allow the user to complete the trip manually in Uber.

Never silently omit a requested stop while implying it was successfully passed to Uber.

### Important

The app must not claim to receive Uber trip status or Uber driver GPS data without the required authorized integration.

---

## 9. Weak route section visualization

Identify segments whose safety indicator falls below a configurable threshold.

Initial threshold:

**35/100**

### Map behavior

- Selected route: clearly visible base color
- Weak segments: prominent red overlay
- Moderate segments: amber/yellow where useful
- Stronger segments: green or selected-route styling
- Unknown-data segments: distinct uncertainty styling where appropriate

Make the legend understandable for color-blind users.

Do not rely on color alone.

### Weak-section details

When a user taps a highlighted section, show:

- Section score
- Approximate section length
- Main factors affecting the score
- Relevant available POI information
- Data confidence
- Whether the assessment uses direct data or proxies

Example:

"Potentially isolated stretch — 180 m. Fewer expected-open businesses nearby. Lighting coverage is unknown."

Never call an area criminal or definitively unsafe based solely on incomplete OSM data.

---

## 10. Live trip monitoring and alerts

Allow the user to start an active SafarNav journey.

### Permission

Request geolocation only after the user explicitly starts navigation or selects current location.

### Location monitoring

Use the browser Geolocation API where supported.

Implement:

- Location updates through `watchPosition`
- Permission and error handling
- High-accuracy mode when appropriate
- GPS accuracy indicators
- Movement smoothing
- Optional follow-user camera
- Distance remaining
- Estimated arrival
- Progress along the route
- Off-route detection

Use GPS accuracy to avoid unnecessary alerts or rerouting from noisy location readings.

### Segment monitoring

During an active journey:

1. Match the user's location to the chosen route.
2. Determine which segment they are approaching.
3. Identify upcoming weak segments.
4. Calculate approximate distance to the segment.
5. Warn before the user reaches that section.

Example alert:

"Heads up: a lower-scoring 200 m stretch is approximately 150 m ahead. Stay aware of your surroundings."

Make the alert distance configurable.

### Notifications

Prioritize:

- In-app alerts
- Accessible visual banners
- Optional vibration where supported
- Browser notifications where available and explicitly permitted

Deduplicate alerts and apply cooldowns.

Do not repeatedly warn for the same segment.

Do not show warnings for segments already passed.

### Browser limitations

Implement realistic browser behavior.

A web app cannot rely on uninterrupted GPS tracking while fully suspended, closed or backgrounded, especially on mobile devices.

Do not pretend that push notifications solve unavailable background geolocation.

Show a clear indication when active monitoring requires SafarNav to remain open and foregrounded.

When the user switches to Uber, do not falsely claim continuous SafarNav tracking unless the browser genuinely continues providing location updates.

### Privacy

Keep active precise location in memory when possible.

If the user opts into location caching, store only the minimum data required, with a short expiration policy.

Allow tracking to be paused or stopped at any time.

---

## 11. Location caching and performance

Use caching carefully to improve speed without compromising privacy.

### Local caching

Consider:

- React Query/TanStack Query for request-state caching
- In-memory caches
- Session storage for session-specific preferences
- IndexedDB for suitable non-sensitive geographic datasets

Cache:

- Recently used place selections
- Map preferences
- Route geometries within a reasonable TTL
- POI data by geographic region
- Infrastructure lookups
- Time-independent geographic metadata

Cache the user's precise location only with appropriate consent and a short TTL.

Do not store continuous location history by default.

### Backend caching

Create a server-side caching abstraction.

For the hackathon, use:

- Native Next.js caching where appropriate
- Deterministic request keys
- Reasonable TTLs
- Stale-data notices where relevant

Remember that module-memory caches in serverless environments are not reliably shared between instances.

Allow later integration with a durable cache provider without major code changes.

### Suggested cache policies

Use configurable defaults appropriate for each dataset:

- Road infrastructure: longer TTL
- POIs: moderate TTL
- Opening-hours metadata: moderate TTL
- Route geometry: short to moderate TTL
- AI explanations: based on input fingerprints
- Live location: short-lived and primarily local

Never label cached OSM information as live sensor readings.

### Performance requirements

Optimize for:

- Minimal initial JavaScript
- Smooth map interactions
- Fast route switching
- Smooth Time Machine updates
- Minimal unnecessary external requests
- Efficient geometry calculations
- Mobile data usage
- Graceful loading states

Use:

- Dynamic imports
- Debouncing
- Memoization
- Spatial indexing where useful
- GeoJSON source updates rather than full map recreation
- Web Workers if necessary
- Request cancellation for outdated searches

Implement loading skeletons, clear error messages and retry actions.

Aim for good Core Web Vitals on ordinary mobile connections, but measure rather than invent performance claims.

---

## 12. Post-journey feedback

Once the user finishes a journey in SafarNav, show an optional feedback form.

### Triggering

For the MVP:

- The user can tap "I've arrived."
- Optionally suggest arrival when the GPS location is near the destination.
- Require explicit confirmation before ending the journey.

Do not assume an Uber ride has finished simply because Uber was opened.

### Questions

1. How safe did you feel during the journey? (1–5)
2. Were there streetlights along the route?
   - Yes, most of the route
   - Some sections
   - Very few
   - Not sure
3. How active or populated did the route feel?
   - Busy
   - Moderately active
   - Mostly quiet
   - Not sure
4. Did you notice any concerning or poorly lit sections?
   - Yes
   - No
   - Not sure
5. Optional comments.

Where useful, allow an optional map-based selection of the concerning segment.

### Data storage

Use Neon PostgreSQL for feedback.

Create appropriately normalized tables such as:

- `journey_feedback`
- `segment_observations`
- `aggregate_segment_metrics`

Use migrations.

Store only necessary data.

Avoid storing precise continuous journey history, names or personal identifiers by default.

Use coarse geographic references or appropriately generalized segment identifiers when possible.

Validate and sanitize all inputs.

Implement request-size limits, abuse prevention and rate limiting.

### Feedback influence

Do not immediately let a single feedback submission dramatically change public route safety scores.

For the MVP, display feedback separately as community observations or use carefully controlled low-weight aggregates only after reasonable minimum sample counts.

Keep a clear distinction between:

- Mapped infrastructure data
- Model-derived assessments
- Community feedback

Prevent duplicate submissions where reasonably possible without invasive tracking.

Do not expose individual reports in a way that reveals a traveller's identity or exact journey.

---

## 13. UI and UX design

Create a high-quality, modern, calm and trustworthy interface.

### Visual direction

Brand: SafarNav

Personality:

- Reliable
- Clear
- Minimal
- Modern
- Safety-focused
- Accessible

Avoid excessive animations, distracting gradients or unnecessary visual clutter.

Use a professional palette with:

- Deep navy/charcoal for primary text
- Teal or blue-green for brand identity
- Green for relatively stronger segments
- Amber for caution
- Red for low-scoring sections

The numerical safety indicators must remain readable independently of color.

### Desktop layout

Use:

- A compact header with SafarNav branding
- A route-search panel on the left
- A large interactive map on the right
- A route comparison panel
- A Time Machine control
- An expandable route details view
- An AI explanation section

The map should remain the central visual element.

### Mobile layout

Design mobile-first.

Use:

- Full-height interactive map
- Compact floating search controls
- Collapsible bottom sheet
- Route cards in a horizontal or vertical compact layout
- Large touch targets
- Thumb-friendly Time Machine slider
- Bottom-sheet route details
- Clear Start Journey and Uber actions
- Minimal obstruction of the map

Support iOS Safari and Android Chrome.

Respect safe-area insets.

Use responsive touch interactions and avoid UI overflow.

### Important screens/states

Implement:

1. First launch and empty state
2. Route-search state
3. Loading routes
4. Route comparison
5. Selected-route details
6. Time Machine interaction
7. AI explanation
8. Uber stop consent and preview
9. Active journey
10. Weak-section alert
11. Arrival confirmation
12. Feedback form
13. Offline or provider error states

### Accessibility

Include:

- Keyboard navigation
- Visible focus indicators
- Screen-reader labels
- Accessible modal and bottom-sheet behavior
- Contrast-compliant text
- Reduced-motion support
- Sensible loading and alert announcements

---

## 14. Database architecture

Only persist data that needs persistence.

Use Neon primarily for anonymous journey feedback, aggregated observations and other genuinely necessary application data.

Do not add mandatory user registration for the MVP.

Create migrations and typed queries.

Use:

- `DATABASE_URL` for application traffic
- A separate direct database URL for migrations when required

Use Neon's connection pooling guidance for serverless environments.

Use sensible indexes and transaction boundaries.

The application should remain usable for route planning even when the feedback database is unavailable.

Do not couple route calculation to successful feedback persistence.

---

## 15. Backend API design

Create clear, validated, modular endpoints.

Suggested endpoints:

### `GET /api/geocode`

Search and resolve place queries through the configured geocoding provider.

### `POST /api/routes`

Input:

- Origin
- Destination
- Travel mode
- Departure time

Output:

- Candidate route geometries
- Distance and duration
- Segment scoring results
- Route scoring results
- Confidence and evidence metadata
- Route rankings

### `POST /api/routes/rescore`

Re-evaluate precomputed routes for a new departure time without unnecessarily refetching invariant geographic data.

Do not trust arbitrary client-supplied scoring data.

### `GET /api/pois`

Retrieve appropriately filtered POIs for requested geographic regions.

Enforce geographic bounds and request limits.

### `POST /api/ai/route-summary`

Generate an AI explanation from validated computed route facts.

### `POST /api/uber/link`

Validate the selected route and optional waypoint, and generate a supported Uber handoff URL.

### `POST /api/feedback`

Validate and persist anonymous journey feedback.

### `GET /api/health`

Return application health and relevant integration configuration status without exposing secrets.

Use consistent error schemas.

Prevent unbounded requests, injection, unrestricted expensive geospatial searches and external-provider abuse.

Keep API secrets server-side.

---

## 16. Folder and software architecture

Use a maintainable project structure similar to:

- `src/app/` — pages, layouts, API routes
- `src/components/` — reusable UI components
- `src/components/map/` — MapLibre components
- `src/components/routes/` — route cards and comparison
- `src/components/time-machine/` — time slider UI
- `src/components/journey/` — journey monitoring and alerts
- `src/components/uber/` — Uber integration UI
- `src/components/feedback/` — feedback interface
- `src/lib/geo/` — geometry and spatial functions
- `src/lib/scoring/` — deterministic scoring engine
- `src/lib/providers/` — routing, geocoding, POI and AI adapters
- `src/lib/cache/` — caching abstraction
- `src/lib/uber/` — waypoint selection and link generation
- `src/lib/ai/` — prompt and response validation
- `src/lib/db/` — database access
- `src/lib/validation/` — schemas
- `src/types/` — shared types
- `drizzle/` — migrations
- `tests/` — tests and fixtures
- `public/` — icons and static assets
- `docs/` — architecture and developer documentation

Adapt the layout if needed, but maintain separation of concerns.

Business logic should not be embedded inside React UI components.

---

## 17. Demo mode and missing credentials

This project must be demonstrable without all external accounts being configured.

Implement a clearly labeled Demo Mode using deterministic, documented sample fixtures where real provider access is unavailable.

Demo Mode should:

- Render a map where a map source is configured.
- Display fixture route geometries.
- Calculate actual scores from the fixture data.
- Support Time Machine recomputation.
- Highlight weak sections.
- Show deterministic route summaries.
- Demonstrate the Uber waypoint-selection UI without falsely claiming a live booking integration.
- Demonstrate feedback submission with clear local/demo behavior.

Do not silently switch live functionality to mock results.

The interface must clearly identify demo data.

Provide a real-data mode using the configured external services.

If a required provider key is missing, show actionable setup guidance.

Do not hardcode real-looking fabricated infrastructure or falsely label it as verified OSM data.

---

## 18. Environment configuration

Create a comprehensive `.env.example`.

Include relevant variables such as:

- `ORS_API_KEY`
- `ORS_BASE_URL`
- `OVERPASS_API_URL`
- `GEOCODING_PROVIDER`
- `GEOCODING_API_KEY`
- `GEOCODING_API_URL`
- `NEXT_PUBLIC_MAP_STYLE_URL`
- `NEXT_PUBLIC_MAP_API_KEY` if required by the selected map provider
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `DATABASE_URL`
- `DIRECT_URL`
- `UBER_CLIENT_ID`
- `NEXT_PUBLIC_SITE_URL`
- `DEMO_MODE`

Add any genuinely required configuration.

Explain exactly which services are free, rate-limited, optional or require a key, according to current provider documentation.

Never commit `.env.local` or secrets.

Keep public and server-side environment variables correctly separated.

---

## 19. Testing requirements

Write meaningful tests, particularly for the scoring and time-dependent logic.

### Unit tests

Test:

1. Weight totals equal 100 for both modes.
2. Normalization functions remain within 0–100.
3. Route score changes when a relevant shop closes.
4. Closed businesses do not receive open-business activity credit.
5. Missing business hours remain Unknown.
6. Overnight opening schedules work.
7. Weekday changes work.
8. Arrival-time-based POI evaluation works.
9. Morning/daytime lighting logic differs appropriately from night.
10. Unknown lighting does not become known darkness.
11. Segment scores stay within 0–100.
12. Route length weighting is correct.
13. Longer routes do not automatically win due to more POIs.
14. Route ranking is deterministic.
15. Weak sections are detected correctly.
16. Data confidence decreases when evidence is missing.
17. Walking and Driving use different weights.
18. Inaccessible routes and invalid waypoints are rejected.
19. A valid Uber link preserves the correct stop order.
20. Gemini outputs cannot overwrite computed scores.

### Integration tests

Test:

- Route provider response normalization
- POI extraction from OSM/Overpass responses
- Geocoding provider errors
- Time Machine rescoring
- Gemini unavailable fallback
- Feedback validation and persistence
- Caching behavior
- Unauthorized requests and rate limits

### Browser tests

Test:

- Search for a route
- Compare alternatives
- Select a route
- Change departure time
- Inspect weak sections
- Open route details
- Review the optional Uber waypoint
- Start and stop a journey with mocked GPS
- Submit feedback

Test mobile viewport layouts.

Where live services require accounts, use mocks for automated tests and document manual device testing.

---

## 20. Performance and reliability standards

- Use strict TypeScript.
- Avoid unnecessary dependencies.
- Keep UI state predictable.
- Cancel superseded requests.
- Prevent race conditions during rapid Time Machine changes.
- Validate coordinates and geographic bounds.
- Handle missing data and malformed provider responses.
- Avoid excessive API usage.
- Use appropriate caching.
- Avoid unnecessary database operations.
- Avoid exposing secret keys in client bundles.
- Handle offline and unavailable-provider states gracefully.
- Keep route calculation independent from AI availability.
- Maintain a usable mobile UI during loading.

Do not claim guaranteed sub-second performance without measurement.

Document observed performance and remaining bottlenecks.

---

## 21. Security, privacy and responsible safety language

SafarNav is a navigation decision-support application, not an emergency response service.

Include a concise disclaimer:

"Safety scores are estimates based on available infrastructure and mapping data. They do not guarantee personal safety."

Additional requirements:

- Do not require location permission on page load.
- Request consent for active GPS tracking.
- Request consent separately for Uber intermediate stops.
- Do not upload location histories by default.
- Do not expose users' journey histories publicly.
- Do not include precise location coordinates in application logs unless technically necessary and protected.
- Sanitize user feedback.
- Implement appropriate server-side validation and rate limits.
- Use secure environment-variable handling.
- Show data uncertainty clearly.
- Respect applicable mapping-service terms and attribution requirements.
- Do not imply real-time crime, surveillance, lighting or crowd data exists if it is not actually integrated.
- Do not discriminate against neighborhoods or people using demographic proxies.

---

## 22. Implementation order

Work in these phases.

### Phase A — Foundation

- Initialize Next.js and TypeScript.
- Install required dependencies.
- Configure Tailwind and UI components.
- Create the layout and map.
- Create environment configuration.
- Establish routing and geographic provider adapters.

### Phase B — Functional core

- Origin/destination selection.
- Walking and Driving modes.
- Multiple real routing alternatives.
- POI acquisition.
- Time-aware business status.
- Segment-based deterministic scoring.
- Route ranking and comparison.
- Confidence and evidence display.

### Phase C — Differentiating features

- Time Machine.
- Weak-segment visualization.
- Gemini explanations.
- Uber intermediate-stop selection and deep linking.
- Active journey monitoring.
- Foreground weak-section alerts.
- Post-journey feedback.

### Phase D — Production readiness

- Neon persistence where needed.
- Cache strategy.
- Demo fixtures.
- Accessibility.
- Mobile optimization.
- Unit and integration testing.
- Browser testing.
- Documentation.
- Vercel readiness.

Do not skip core functionality to spend excessive time on animations.

If an external provider blocks progress, implement a properly documented adapter or fallback, continue with other requirements, and clearly report the limitation.

---

## 23. Final deliverables

The final repository must contain:

1. Functional Next.js application.
2. Responsive desktop and mobile interface.
3. Working map and route rendering.
4. Real routing integration.
5. OSM infrastructure extraction.
6. Time-aware opening-hours evaluation.
7. Explainable safety scoring.
8. Alternative route ranking.
9. Interactive Time Machine.
10. Gemini-powered route explanations.
11. Uber integration with stop consent and fallback.
12. Low-scoring section visualization.
13. Realistic foreground trip monitoring.
14. Weak-section alerts.
15. Feedback workflow.
16. Neon persistence for feedback where configured.
17. Clear Demo Mode.
18. `.env.example`.
19. `.gitignore`.
20. README with setup instructions.
21. Database migration instructions.
22. Tests.
23. Vercel deployment instructions.
24. Technical architecture documentation.
25. Documentation of limitations and third-party service restrictions.

### README requirements

Explain:

- What SafarNav does.
- Architecture.
- Technology stack.
- All required API keys.
- Local installation.
- Local development command.
- How to enable real-data mode.
- How to enable Demo Mode.
- Neon setup and migrations.
- Gemini configuration.
- Uber developer configuration.
- Map provider configuration.
- How to run tests.
- How to push to GitHub.
- How to deploy to Vercel.
- Privacy and safety limitations.

### Final verification

Before reporting completion:

1. Install dependencies.
2. Run TypeScript checks.
3. Run linting.
4. Run automated tests.
5. Run the production build.
6. Run available end-to-end tests.
7. Check major user journeys.
8. Verify there are no exposed credentials.
9. Confirm the repository is ready for Git.
10. Report features that still require API credentials or real-device validation.

Do not claim tests passed unless they actually ran successfully.

At the end, provide:

- A concise implementation summary.
- Exact commands to launch locally.
- Environment variables still requiring user configuration.
- Features implemented.
- Remaining limitations.
- Vercel deployment steps.
- Suggested immediate improvements.

## Final instruction

Build SafarNav as a cohesive product, not a set of disconnected pages or mocked widgets.

Its defining innovation is not the presence of AI alone. It is the combination of real geographic data, mode-specific and time-dependent route analysis, explainable scoring, weak-section awareness, and a practical ride-booking workflow.

Prioritize correctness, usefulness, speed and transparency throughout.

Begin by inspecting the local development environment and project directory, then implement the project systematically. Do not pause for unnecessary confirmation when reasonable engineering defaults can be chosen. Document assumptions and limitations.