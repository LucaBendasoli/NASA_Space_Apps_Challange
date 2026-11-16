# Infrared analysis and source selection validation

Run on November 14, 2026 (São Paulo time).

- `npm.cmd test` passed 22 tests, including 10 new tests for the contract, asynchronous state, catalog, and HTTP provider.
- `npm.cmd run verify:upstream` verified all 429 upstream files.
- Microsoft Edge ran through the Playwright CLI with desktop (1366 × 900) and mobile (390 × 844) viewports, using real WebGL and Aladin.

## Browser demonstration

Clicking a native source opened the chart for A. Selecting B updated the chart and table. The test covered missing bands, zero values, permitted negatives, incomplete results, and a source without measurements. Selecting a different source with the keyboard (Home, arrow keys, Enter) updated both the control and the panel. The grid, educational catalog, and sharing controls remained functional. A local search for M42 opened a region outside demo coverage.

Clicks were checked after zooming, switching between AIT and MOL projections, panning, and resizing. For the final check, the test intercepted only the project's own `app.js` module to expose the real atlas instance. The public `world2pix` method located the source before and after gestures. Panning changed its projected position, and a click at the new position opened measurements for the same ID. The test used the catalog as supplied by the demo provider and the real renderer. The temporary script is `output/playwright/validate.js`, a local artifact ignored by Git.

Switching surveys cleared the chart and selection, while switching mirrors within the same survey preserved the ID, observation, and survey. Light and dark themes were tested with the chart open, and it remained usable after resizing. The mobile viewport had no horizontal page overflow. The chart and table could scroll horizontally within their own containers to keep axes and values readable. Local captures in `output/playwright/` include `desktop-chart.png`, `mobile-chart.png`, and `mobile-final.png`.

## HTTP and validation limits

In `?science=http` mode, the default base URL returned HTTP 404 because no service was available. The panel showed an error and a retry button, with no demo sources displayed. Measurement request failures and retries also have unit tests. The HTTP check covered error handling only.

The optional local bundle `vendor/aladin.js` was absent (expected 404). The official remote fallback loaded the configured version and rendered DSS images. The external Aladin logger encountered a DNS error, and the remaining tests continued. WebGL was available.

The test scope excluded real scientific measurements, the production science service and CORS, future authentication, astrometric accuracy for real observations, remote Sesame searches, screen readers, and physical-device touch. Mobile behavior was checked using a viewport, with keyboard and click input in the desktop browser. A catalog test covers disambiguation between nearby sources. Validation against a real, dense scientific catalog remains pending.
