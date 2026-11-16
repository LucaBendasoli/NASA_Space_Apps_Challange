# Analysis state, pinning, measurements, and sharing

## Usage

The default `provider: 'off'` shows **Analysis not configured** without a source list, clear action, or simulated count. **Try the demo** explicitly enables `?science=demo` and opens the initial Andromeda field with simulated sources and values. For HTTP, configure `src/science-config.js` and use `?science=http`. See the [provisional contract](backend-infravermelho.md).

Regional states distinguish configured and querying, results, an empty response, no coverage, partial coverage or results, a field above the query limit, and errors. Catalog coverage only describes the query and its data. An API error leaves demo mode off.

## Pinning, unpinning, closing, and clearing

- **Pin analysis** keeps the selection, chart, and measurement request during navigation even if the regional response omits the source or the field requires zooming in. Catalog markers still come only from the current regional response.
- **Unpin analysis** keeps the current selection at the moment of the click. The next regional query retains it only if that query returns it.
- Selecting another object updates analysis while retaining the pin.
- **Close measurements** hides the panel while retaining selection, cache, and pin. A later response leaves the panel closed.
- **Clear selection** removes measurements and pinning while leaving the interface region and session science cache available.
- Changing the survey or observation restriction invalidates incompatible selection, responses, and pinning. Switching only the mirror preserves scientific identity.

The out-of-field indicator uses public `world2pix` and `getSize` to determine projected visibility. If the transformation fails, visibility is unknown. A missing entry in a partial response has its own message. The query cone can include sources outside the viewport rectangle.

## Reading and accessibility

Selection and pinning remain available outside the panel's scroll area. Options show name, ID, and observation to distinguish duplicate names. The title identifies the selection, and provenance distinguishes background imagery, measurement dataset, and observation. Full IDs and coordinates are in the details.

A custom tooltip supports mouse, focus, and emulated touch. It shows the band, wavelength, radiance, units, uncertainty, and supplied quality. It highlights the point or bar and matching table row, even when the table is collapsed. Rows without measurements have no plotted points. Escape dismisses the tooltip before the panel. Outside input, panel closure, and data updates also dismiss it. The tooltip stays within the viewport and avoids capturing gestures. Internal scrolling caused by focus updates its position without moving the page.

Ticks use readable numeric steps, the X scale is continuous, and zero has a reference line. The plot is linear with discrete measurements and preserves original values during presentation. Tooltips and the table display full supplied values without extra rounding. Unknown quality is shown as received.

Supporting controls use a 12 px base expressed in `rem`. A 200% root font size scales controls and the table. SVG geometry and typography use SVG units and scale with the container. Full text values remain in the tooltip and table. On short landscape viewports, lengthy provenance is visually moved out of the main flow and remains in the details and accessibility tree. The heading, selection, and chart retain priority. GSAP timelines, reduced motion, and the stable container behavior were retained.

## HiPS image state

`image-status.js` distinguishes engine startup, readiness, and error from layer waiting, requesting, prepared without visual confirmation, and error. Versioned callbacks ignore older mirror responses. **Try another mirror** switches between ESA and China-VO within the same survey.

The integration was checked against the original `A.js`, `HiPS.js`, and `Aladin.js` snapshot and official [Aladin](https://cds-astro.github.io/aladin-lite/Aladin.html) and [HiPS](https://cds-astro.github.io/aladin-lite/HiPS.html) documentation. It uses `A.HiPS(url, {successCallback,errorCallback})` and `setBaseImageLayer`. The success callback runs when the engine adds the layer. Tile download and painting remain unconfirmed, so the UI describes on-demand imagery with unconfirmed rendering. It uses neither a separate `properties` request nor pixel sampling to infer loaded tiles or coverage. A dark region can have several causes.

## Sharing

`science-share.js` keeps `ra`, `dec`, `fov`, `survey`, and `projection`. A selection adds:

```text
objectId=object-123&objectSurvey=wise&observation=observation-456&pinned=1&dataProvider=http
```

The helper checks identity, ID length and control characters, context, duplicates, coordinates, projection, and pinning. Links omit payloads, free-form names, API URLs, and secrets. Link generation strips credentials and unrecognized query parameters and keeps only the explicit `science` mode. `dataProvider` declares the expected provider, which must match the active config or explicit query. Legacy links restore only the view.

A valid link queries the proposed `GET objects/{id}` endpoint before fetching measurements. It works independently of an existing cache and adds no regional marker. Unavailable objects can be retried. Disabled and incompatible providers have dedicated messages. An explicit user selection takes precedence over restoration already in flight.

## Validation performed

- `npm.cmd test` passed **35 tests**, covering regional states, pinning outside a query, incompatible context, navigation during a pending measurement, projected visibility, legacy, new and invalid links, ID lookup, full values and quality, and stale image callbacks. Existing tests also cover closure and out-of-order responses.
- `npm.cmd run verify:upstream` verified all **429 files** and `git diff --check` passed.
- Edge with real Aladin and WebGL used 1440×900, 390×844, 844×390, and 720×450 for enlarged text. The explicit demo covered native source A, pinning and navigating to another region, sharing and recovering A outside the query, unpinning without immediately clearing, selecting B, matching points to table rows, Escape dismissing the tooltip first, and clearing selection.
- Selection left `scrollX/scrollY` unchanged, with panel, title, and selector in view. In 390 px-high landscape, the chart ended near y=360 and the panel near y=378. No tested viewport had horizontal overflow.
- Light and dark themes and `prefers-reduced-motion` were switched. The final transform was `none`. A 200% root text setting increased the pin button from 12 to 24 px and kept close and pin accessible without horizontal overflow. This tested CSS font scaling.
- Dragging changed RA. Zoom and MOL preserved pinned analysis. Local M42 search, grid, educational catalog, and mirror switching were exercised. Survey changes cleared incompatible charts.
- Controlled browser HTTP routes tested A→B→C with different delays, leaving only C, removing the old chart while loading, closure during fetch, immediate cache hits, retries after measurement and regional HTTP 503, partial and missing coverage, and empty results. A pinned source missing from the response but inside the field was correctly left without an out-of-field notice. Retrieval by ID after navigation passed.
- A simulated China-VO `properties` failure triggered the native layer-error callback and preserved scientific identity.
- In a separate browser context with `hasTouch:true` and `isMobile:true`, tapping a point showed quality and zero in the tooltip, and tapping Close hid the panel.
- Shared source HTTP 404, disabled and incompatible providers, and legacy links were checked separately in the browser.

Git-ignored captures include `output/playwright/improved-desktop-final.png`, `improved-mobile-final.png`, `improved-landscape-final.png`, and `improved-text200-final.png`. Scripts are `improvements-check.js` and `improvements-http-touch.js`. Instrumentation exposed the real Aladin instance for public navigation and state checks.

## Observed limits and follow-up

This session used controlled HTTP routes to exercise frontend behavior. Production service availability, scientific and astrometric accuracy, screen readers, and physical devices remained unverified. A real API must support lookup by identity, return accurate names and provenance, define units and uncertainty and quality semantics, and configure CORS.

The external Aladin logger still failed DNS, and the remote fallback initialized because the optional local bundle was absent. External HiPS imagery can take time to load, and layer success leaves rendering unconfirmed. This historical run did not measure FPS or deploy, commit, or push. [Object comparison](comparacao-astros.md) was implemented later. Export remained outside scope.
