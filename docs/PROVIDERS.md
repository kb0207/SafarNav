# Provider setup, attribution and limits

Documentation checked during implementation on 14 November 2026. Provider plans, quotas and models change; the linked account dashboards are the source of truth before deployment. Do not interpret a free tier as unlimited production capacity.

| Provider                                                                                       | Role                                 | Key/account                      | Cost and constraints                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [openrouteservice / HeiGIT](https://account.heigit.org/info/plans)                             | Walking/driving alternatives         | Directions API key               | Hosted plans impose daily/per-minute and endpoint-specific limits. Check the current Standard/free allowance in your dashboard. No unlimited-capacity claim is made.                                                                                                          |
| [Geoapify](https://www.geoapify.com/pricing/)                                                  | Autocomplete                         | API key                          | Free plan is credit/rate limited; the published autocomplete page advertises up to 3,000 requests per day. Credits may be shared across APIs. Paid plans expand capacity. Required attribution is displayed.                                                                  |
| [OpenFreeMap](https://openfreemap.org/quick_start/)                                            | Browser map tiles/styles             | Public default requires no key   | Public hosted styles include Positron; retain OpenFreeMap/OpenMapTiles/OSM attribution from the style. Evaluate availability and hosting needs for production.                                                                                                                |
| [OpenStreetMap](https://www.openstreetmap.org/copyright)                                       | Mapping data                         | No app API key                   | ODbL data attribution required. OSM is a geographic database, not the directions API.                                                                                                                                                                                         |
| [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API)                                   | OSM infrastructure extraction        | Public default requires no key   | Shared community capacity, timeouts and resource limits; not a commercial SLA. Bound queries and cache; use a dedicated instance for sustained traffic.                                                                                                                       |
| [Gemini](https://ai.google.dev/gemini-api/docs/pricing)                                        | Optional evidence explanation        | Google AI Studio API key         | Limited free access depends on model/account/region; paid quotas and terms differ. Model configurable. No key/failure falls back locally. Consult data-use terms before sending sensitive context; this implementation sends compact route facts without precise coordinates. |
| [Neon](https://neon.com/pricing)                                                               | Optional feedback database           | PostgreSQL connection URLs       | Free plan with storage/compute quotas; paid tiers available. Use pooled app connections and a direct migration URL.                                                                                                                                                           |
| [Uber](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction) | Optional user-controlled app handoff | Optional developer client ID     | Documented deep links prefill pickup/destination. No ride is purchased or price quoted by SafarNav. Final rides/stops incur whatever Uber quotes and the user approves.                                                                                                       |
| [Vercel](https://vercel.com/docs/plans)                                                        | Next.js hosting                      | Vercel account/GitHub connection | Choose a plan consistent with usage and its terms; function/runtime and bandwidth limits apply. Free/personal use is not blanket permission for all commercial usage.                                                                                                         |

Other references:

- [ORS request/response formats](https://github.com/GIScience/openrouteservice/blob/main/docs/api-reference/endpoints/directions/requests-and-return-types.md)
- [Official ORS alternative-route parameters](https://github.com/GIScience/openrouteservice-py/blob/master/openrouteservice/directions.py)
- [Geoapify autocomplete](https://www.geoapify.com/address-autocomplete/)
- [Google GenAI JavaScript SDK](https://googleapis.github.io/js-genai/index.html)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app)
- [Nominatim public usage policy](https://operations.osmfoundation.org/policies/nominatim/): the public endpoint is not used for autocomplete.

Only operator-controlled environment variables select provider URLs; users cannot submit arbitrary provider endpoints. Secret-bearing provider URLs are not printed to application logs. Map style URLs and any keys in them are public browser assets, so use public, domain-restricted map keys only.

## Overpass HTTP 406 and missing scoring evidence

Overpass rejects stock HTTP-client identities. SafarNav now sends its own honest User-Agent automatically, with JSON Accept and a form-encoded POST query. No new API key is needed. Optional `OVERPASS_USER_AGENT` can identify your deployment and public contact URL. Do not impersonate browsers or rotate identities to evade access limits.

Identical active queries are coalesced and requests are serialized per process. Access/rate/transient rejections trigger a cooldown of at least 30 seconds, respecting longer Retry-After headers. No automatic mirror rotation or immediate retry follows a rejection. These guards are not distributed across Vercel instances; use a dedicated service or shared limiter for scale.

If HTTP 406 persists with the custom identity, consult the provider operator about deployment access rather than repeatedly retrying. Errors and insufficient-data warnings remain honest: SafarNav never fabricates infrastructure to fill the gap. After a provider problem is resolved, click Compare routes again to fetch fresh evidence; Time Machine deliberately reuses the previous snapshot.

[Operator guidance](https://github.com/drolbr/Overpass-API/issues/791)

OpenFreeMap (the default map style) needs no API key. Leave `NEXT_PUBLIC_MAP_API_KEY` empty. Map tiles and Overpass infrastructure are separate services; that variable cannot fix infrastructure errors.

Optional live check (a fixed public New Delhi area, no keys):

```bash
CHECK_LIVE_OVERPASS=true npm test -- tests/overpass.live.test.ts
```

## Infrastructure outage fallback

When Overpass fails, SafarNav uses the existing server-side `GEOCODING_API_KEY` for the [Geoapify Places API](https://apidocs.geoapify.com/docs/places/). No new map key is needed. Set `INFRASTRUCTURE_FALLBACK=none` to disable this behavior (default: `geoapify`). It makes three bounded requests, up to 250 places / 13 credits per cache miss, and caches results for 30 minutes. This consumes the same Geoapify account quota as search.

This fallback supplies real, explicitly labelled OSM-derived businesses, emergency facilities and transit places. It is a capped sample, filtered to proximity to the candidate routes, not a complete inventory. It cannot replace Overpass road geometry, lighting or surveillance evidence. Missing schedules remain unknown and missing scoring factors remain neutral. A limited-coverage warning remains visible; confidence can still be low.

When no infrastructure is available for a route, the UI shows “No data” instead of the internal neutral estimate, hides its factor breakdown and reports weak sections as unassessed. If any route lacks evidence, comparison uses travel time and the summary makes no safety recommendation. Retry **Compare routes** to acquire a fresh snapshot; changing departure time reuses existing evidence.

Optional real-provider smoke test (uses your configured key and a fixed public New Delhi area): `CHECK_LIVE_PLACES=true npm test -- tests/places.live.test.ts`.
