# Comparing observations of the same object over time

Two native radio buttons above the dropdown switch between **Between objects** and **Over time**. Opening the panel or clicking a primary source starts in **Between objects** mode with one line. In time mode, the reference is the observation associated with the selected source. The dropdown starts at **Select another date to compare**. Choosing a date adds a line for the same scientific identity in the selected observation. One other date can be compared at a time. Choose the first option to remove the comparison.

Both modes share the chart area, green and purple series colors, numerical scales, line animation, tooltips, uncertainty bars, and table. X positions use each observation's effective wavelengths, so different wavelengths appear at different positions. Radiance is read separately for each observation. The browser performs no temporal trend estimation, spectral shift estimation, interpolation, or calibration.

Switching modes retains each comparison while the primary source remains selected. Clicking any source again or reopening the panel resets the mode and clears both comparisons. Pinning retains the reference during navigation, and observation history is independent of neighboring regional results. Changing the survey or switching to an incompatible context clears the old data. Shared links restore the primary selection and open in the first mode.

Dates come from the backend. Date-only values are shown without a time. Timestamps display in UTC, with the original timestamp and observation identifier in tooltips and the table. The legend reports an unknown date when the reference has none. Observations may share a timestamp and remain distinguishable by their IDs.

Selecting a date leaves the background HiPS layer in place. That layer can combine multiple exposures. `imageId` identifies the science image associated with the observation in its details. It does not request an image download or overlay.

## Provisional integration

The standalone prototype had no science backend. The endpoint below was proposed for the `createProvider().observations` adapter. Its measurements use the existing provisional endpoint with a different `observationId`.

```http
GET {baseURL}objects/{id}/observations?surveyId=dss&referenceObservationId=obs-2025&limit=100
```

```json
{
  "id": "star-123",
  "surveyId": "dss",
  "referenceObservationId": "obs-2025",
  "complete": true,
  "nextCursor": null,
  "observations": [
    {
      "id": "star-123",
      "name": "Example source",
      "surveyId": "dss",
      "observationId": "obs-2023",
      "observationName": "2023 exposure",
      "observedAt": "2023-01-15T03:00:00Z",
      "imageId": "image-2023",
      "datasetId": "infrared-example",
      "datasetName": "Example infrared dataset",
      "frame": "ICRS",
      "ra": 10.684708,
      "dec": 41.26875
    },
    {
      "id": "star-123",
      "name": "Example source",
      "surveyId": "dss",
      "observationId": "obs-2025",
      "observedAt": "2025-01-15T03:00:00Z",
      "imageId": "image-2025",
      "frame": "ICRS",
      "ra": 10.684708,
      "dec": 41.26875
    }
  ]
}
```

Each entry follows the object contract. The backend supplies the same stable object `id` and requested `surveyId`, a distinct `observationId`, `observedAt`, and ICRS coordinates in degrees. The app does not associate exposures by name, nearby RA/Dec, or pixels. A backend with detection-level IDs must provide a persistent object association before this feature can be enabled.

`observedAt` accepts `YYYY-MM-DD` or ISO 8601 timestamps with seconds and an explicit time zone (`Z` or an offset). Invalid dates, timestamps without a time zone, and duplicate observations are rejected. The reference may appear in the response to supply its date but is excluded from the dropdown. If neither the history nor the regional object includes that date, the reference date remains unknown. `imageId` is optional. Both fields are also accepted on regional results and identity lookups.

For the selected date:

```http
GET {baseURL}objects/star-123/measurements?surveyId=dss&observationId=obs-2023
```

```json
{
  "id": "star-123",
  "surveyId": "dss",
  "observationId": "obs-2023",
  "quantity": "radiance",
  "complete": true,
  "allowNegative": true,
  "measurements": [
    {"bandId":"B1","wavelength":1.3,"wavelengthUnit":"µm","radiance":0.6,"radianceUnit":"W m⁻² sr⁻¹ µm⁻¹","uncertainty":0.15},
    {"bandId":"B2","wavelength":1.8,"wavelengthUnit":"µm","radiance":1.8,"radianceUnit":"W m⁻² sr⁻¹ µm⁻¹","uncertainty":0.15}
  ]
}
```

These values illustrate the payload structure. Series still require identical unit strings. Permitted negatives, zero, missing values, and uninterpreted quality fields retain their existing semantics. Scientific comparison across dates requires the backend to confirm the radiance definition, calibration across instruments and epochs, effective bands, and uncertainty interpretation. Incompatible units show an error while preserving the reference.

`complete` is required. `complete:false` or `nextCursor` indicates partial history. The UI accepts at most `historyLimit` records (100 by default in `science-config.js`) and leaves further pages unloaded. It sorts by date and ID within the query results. HTTP errors, empty histories, and missing measurements have distinct messages. The reference stays visible, and failed requests can be retried. HTTP errors never enable demo data.

## Architecture and demonstration

- `observation-date.js` validates and displays dates.
- `science-data.js` holds the contract, endpoint, and explicit demo payloads.
- `science-time-state.js` handles history, a bounded cache, cancellation, and stale responses and reuses `science-comparison.js` for observation measurements.
- `science-analysis.js` models both modes, series identities, labels, and states.
- `science.js` and `science-view.js` manage the workflow and persistent controls, with one chart and one table in the DOM.

Open `/?science=demo` to enable the demo explicitly. Its simulated reference is from 2025, with simulated observations in 2023 and 2024 for A and B at distinct wavelengths and radiances. The 2024 example includes a missing band and incomplete results. The source without measurements also has an empty history. The fixtures are independent of the HiPS images and do not establish physical changes.

To connect a real service, set `baseURL`, `provider:'http'` (or open `?science=http`), and `historyLimit`. Implement the proposed endpoint or adapt the provider to the final contract. History and measurement caches are keyed by survey, observation, and object and last for the session. Versioning, expiry, and interactive pagination require backend agreement.

Define whether `observedAt` represents the start, midpoint, or another reference time in the exposure. Civil timestamps display in UTC. The backend must normalize astronomical time scales such as TAI and TDB, Julian dates, and leap seconds before they enter this contract.

## Validation performed

- `npm.cmd test` passed **53 tests**, including ten new cases for dates, identity across observations, limits, sorting, the HTTP endpoint, delays, cancellation, caching, empty, error and partial states, units, and comparison mode isolation.
- `npm.cmd run verify:upstream` verified **429/429 files**. `git diff --check` passed.
- Microsoft Edge via Playwright CLI used official Aladin, with in-memory instrumentation to observe its instance. It used the real renderer and markers. Checks covered clicks on A and B, the initial radio mode and single series, radios above the selector, 2023 and 2024 options excluding the 2025 reference, two observation IDs for one source, distinct X positions for different wavelengths, ten table bands per observation, full timestamp and ID in tooltips, changing to an epoch with a missing band, restoring the other comparison mode, and resetting on a new click or reopen.
- The timeline was observed at an intermediate `stroke-dashoffset` of about 0.63. Tests covered light and dark themes, reduced motion, native arrow-key radio navigation, Escape and focus return, focus tooltips, and highlighting a single row for the correct epoch. Mode switches preserved the controls in the DOM.
- Tested 1440×900 desktop and 390×844 mobile. On mobile the radios occupied y=382–439, the selector y=468–512, and the SVG y=639–829. Horizontal overflow was absent and `scrollX/scrollY` stayed `[0,0]`. The mobile SVG was limited to 190 px to accommodate the radios and preserve the lower axis and data proportions.
- At 760×390 the essential controls and panel stayed inside the viewport with internal scrolling. At simulated 200% text size (through root CSS), the radios and selector stayed in view without horizontal overflow. Native browser zoom and physical devices were outside this test.
- Pinning and zoom kept both epochs independently of neighboring sources. With `provider:off`, the comparison modes were hidden and explicit demo activation remained available.
- Intercepted HTTP tests, separate from the demo, covered HTTP 503, retry, partial history, an 850 ms delay, ignoring stale results after switching from 2023 to 2024, incompatible units keeping the reference, closing during loading, empty history, and removing incompatible data after switching surveys. Demo fallback stayed disabled.

Captures include `output/playwright/time-analysis-desktop.png`, `time-analysis-mobile.png`, `time-analysis-reduced.png`, `time-analysis-landscape.png`, and `time-analysis-text200.png`. Local test scripts are in the same Git-ignored directory.

External HiPS imaging failed with DNS errors and timeouts. Screenshots show native markers against a dark background. Alignment on loaded HiPS tiles and availability of real images by date were outside the verified scope. This historical run did not include a real science backend, a physical device, touch, a screen reader, a commit, or a push.
