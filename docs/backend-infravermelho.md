# Provisional infrared API contract

This document records the endpoints proposed for the earlier standalone prototype. The prototype had no science backend. The science team needs to agree on the definition of `radiance`, whether it is spectral or integrated, and its units. Detection, photometry, magnitude, flux and count conversions, and radiance calculations are outside the frontend contract.

The time comparison adds the proposed `objects/{id}/observations` endpoint and optional `observedAt` and `imageId` fields. See the [observation history contract and examples](analise-temporal.md). Time comparisons reuse the measurements endpoint with the relevant `observationId`.

## Configuration

Run `npm.cmd start`. Science data is off by default. Open `http://127.0.0.1:4174/?science=demo` to explicitly enable the demonstration, which uses three simulated sources near Andromeda. Source B illustrates a zero, a negative value, a missing band, and an incomplete response. The third source has no measurements. The simulated sources have no physical identification in the HiPS imagery.

For HTTP, set `baseURL` with a trailing slash and optionally set `observationId` in `src/science-config.js`. Then open `?science=http` or set `provider: 'http'` in that file. External services must support CORS, and an HTTPS page requires HTTPS endpoints. Keep secrets out of the public configuration. API errors never enable demo data. The HiPS mirror is independent of scientific identity.

## Proposed regional query

`GET {baseURL}objects?surveyId=wise&ra=10.68&dec=41.27&width=3&height=2&radius=2.5&limit=500`

Angles are in ICRS degrees. An optional `observationId` restricts the query. The backend must map the stable IDs `dss`, `2mass`, `wise`, and `sdss` to the surveys in `src/sky-model.js` and provide valid scientific associations. A HiPS view can combine imagery from multiple exposures. Each source belongs to an observation, and multiple observations can produce distinct records keyed by `(surveyId, observationId, id)`.

The query cone is centered on the view and uses both field dimensions and the boundaries from the public `getFoVCorners(8, 'ICRS')` API. The query uses spherical geometry across 0°/360°. A projection error or a cone larger than 10° prompts the user to zoom in. The cone can include sources outside the viewport. The server must enforce spatial limits as well.

```json
{
  "coverage": "full",
  "complete": true,
  "nextCursor": null,
  "objects": [{
    "id": "object-123",
    "name": "Optional name",
    "ra": 10.684708,
    "dec": 41.26875,
    "frame": "ICRS",
    "surveyId": "wise",
    "observationId": "observation-456"
  }]
}
```

`coverage` accepts `none`, `partial`, or `full`. The required `complete` field must be accurate. The app displays up to 500 records and leaves subsequent pages for an explicit future implementation. `complete:false` or `nextCursor` flags partial results and prompts the user to narrow the region. With `complete:true`, the backend must return every matching record. Interactive pagination will require stable cursor semantics and regional scope. Coverage describes the data available for a region.

## Proposed measurement endpoints

### Lookup by identity

`GET {baseURL}objects/{id}?surveyId=wise&observationId=observation-456`

This proposed endpoint restores a shared link independently of the regional list or cache. It returns one object with the requested identity, or HTTP 404 when unavailable. The integration lives in `createProvider().object` and can be adapted independently of the catalog and chart.

```json
{
  "id": "object-123",
  "name": "Example source",
  "ra": 10.684708,
  "dec": 41.26875,
  "frame": "ICRS",
  "surveyId": "wise",
  "observationId": "observation-456",
  "observationName": "Example observation",
  "datasetId": "example-ir",
  "datasetName": "Example measurement set"
}
```

`observationName`, `datasetId`, and `datasetName` are optional and may also appear in regional results. The measurement dataset is separate from the background image. HiPS color and pixels provide no dataset identity. When metadata is missing, the interface reports that the dataset was unspecified and preserves the technical IDs. The backend must ensure the association with `surveyId` and confirm the units and uncertainty definitions.

### Bands

`GET {baseURL}objects/{id}/measurements?surveyId=wise&observationId=observation-456`

```json
{
  "id": "object-123",
  "surveyId": "wise",
  "observationId": "observation-456",
  "quantity": "radiance",
  "allowNegative": true,
  "complete": false,
  "measurements": [
    {"bandId":"B1", "wavelength":3.4, "wavelengthUnit":"µm", "radiance":0, "radianceUnit":"W m⁻² sr⁻¹ µm⁻¹", "uncertainty":0.1, "quality":"example"},
    {"bandId":"B2", "wavelength":4.6, "wavelengthUnit":"µm", "radiance":null, "radianceUnit":"W m⁻² sr⁻¹ µm⁻¹", "quality":"no measurement"}
  ]
}
```

The fixture illustrates payload structure. Its values and units are examples. Effective or central wavelengths must be positive and use a consistent definition agreed with the backend. Optional uncertainty is symmetric and non-negative, in radiance units. Its interpretation, such as 1σ, requires agreement. The UI displays optional `quality` verbatim. Negative radiance requires `allowNegative:true`. A null or absent value stays missing. Non-finite values, duplicate bands, invalid coordinates, missing units, inconsistent units within a response, and identity mismatches produce explicit errors. The backend must supply identical unit strings for comparison. The app performs no unit conversion or interpolation. The linear SVG chart shows discrete markers and uncertainty bars, and the table includes missing values and quality.

The backend must apply valid WCS and return ICRS degrees. Pixel coordinates are rejected. The frontend does not convert between original image pixels and screen pixels.

## Synchronization and Aladin integration

See [state, pinning, tooltips, and sharing](melhorias-analise.md). Pinning preserves the selected analysis during navigation without inserting the source into regional results. The cache key remains survey, observation, and object. Links with an identity query the lookup endpoint and leave demo activation explicit.

Queries wait 350 ms after a meaningful position, zoom, projection, or size change. Redraw-only events are ignored. Changes immediately invalidate in-flight responses and cancel requests through AbortController. HTTP requests time out after 15 seconds. A survey change clears sources and selection immediately. Pan or resize preserves selection while loading and reconciles it with the new regional list. A counter also rejects stale responses from providers that ignore cancellation. The session cache holds up to 100 object, survey, and observation keys. Mutable backend data will require observation versioning or an agreed expiration policy.

The custom catalog uses `A.catalog`, `A.source`, `addCatalog`, `removeAll`, `source.select/deselect`, the `onClick` callback, native hover and selection colors, and `world2pix` for visibility and disambiguation within 28 screen pixels. Markers use Aladin's catalog renderer. The map click selects the primary source, offering disambiguation for nearby markers. The panel dropdown only compares other visible sources. Assigning an identity requires a catalog record.

The APIs were checked against the local 3.9.0-beta snapshot (`Catalog.js`, `Source.js`, `Aladin.js`, `View.js`), the [official catalog documentation](https://cds-astro.github.io/aladin-lite/Catalog.js.html), and the [atlas documentation](https://cds-astro.github.io/aladin-lite/Aladin.html). In this version, `aladin.on` supports one callback per event, so the app shares position and zoom callbacks with the existing indicators.

## Requirements for a production science backend

- Confirm the quantity, units, meaning of uncertainty and quality, and effective band definitions.
- Implement the proposed endpoints or adapt the provider to the final contract.
- Define the mapping between HiPS, surveys, and observations, together with coverage, limits, and cursor semantics.
- Ensure valid astrometry, CORS, HTTP errors, and stable identities and versions.
- Validate with real observations. Demo and mock data only exercise their respective integration paths.
