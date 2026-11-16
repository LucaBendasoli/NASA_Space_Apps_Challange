# Validation on November 14, 2026

## Successful checks

- Node.js 26.13.1 was available. The application requires Node.js 22 or later.
- `node --test tests/*.test.mjs` passed all 12 tests.
- The test started the real server on an ephemeral loopback port, verified HTTP responses with fetch, and stopped it afterward.
- The home page returned HTTP 200 with the expected content. JavaScript returned 200 with the correct MIME type, and the original license returned 200.
- HEAD returned no body. POST was rejected. Missing files returned 404, malformed URLs returned 400, and attempts to access a neighboring directory returned 403.
- Coordinate tests covered spherical bounds, poles, signs, invalid inputs, aliases, parsing Sesame responses, and restoring shared links.
- Zoom regression tests covered exact numeric round trips at 0.1 arcseconds, fields smaller than the former limit, and coordinates near 360°. Display tests covered degrees, arcminutes, and arcseconds, including displaying the native minimum field without rounding it to zero.
- Official source confirmed the public `increaseZoom` and `decreaseZoom` methods and their use by the native controls. The custom interface uses those methods and leaves field limits to the engine.
- The server at `http://127.0.0.1:4174` returned 200 for the updated module containing the native control calls.
- `node scripts/verify-upstream.mjs` verified that all 429 files matched the blob hashes of the official commit.
- `node --check` verified syntax in the custom modules.

This run covered the server and application logic. Rendering was outside its test scope.

### Navigation optimization

Four tests with a controlled clock and scheduler verified that a burst of 1,000 requests produces one update with the latest state, continuous events cap panel updates at 10 Hz and still show the final state, updates can be canceled and resumed without an idle loop, and repeated text writes are skipped. The synthetic events exercise the custom scheduler. Aladin already throttles its callbacks, and this suite does not benchmark their frequency.

The configuration disables the native coordinate and field indicators to avoid duplicate updates. Syntax and upstream integrity checks passed. This run did not measure FPS, GPU usage, or network timing, and it included no visual inspection.

## Incomplete checks

- Terminal fetch requests to the official site, npm, and the GitHub API failed with `EACCES`.
- `node scripts/vendor-runtime.mjs` failed with `fetch failed (EACCES)`, so it saved no compiled bundle. The official GitHub connector provided the public source files and their hashes.
- The web tool retrieved textual HTML and official pages but rejected the JavaScript bundle content. Browser availability remained unverified.
- The previous Firefox automation attempt ended because the tool did not support the URL policy for that browser.

## Pending browser checks

At this stage, desktop and mobile visuals, WASM initialization, rendered images, live Sesame responses, catalog clicks, gestures, and survey image changes still required browser testing. Comparing methods against official source verifies the API calls. Browser testing is needed to verify the resulting interactions.

1. Run `npm.cmd start` and open `http://127.0.0.1:4174` in a browser with WebGL 2 and internet access.
2. Confirm that the loading panel disappears, real images appear, and the Aladin Lite logo remains visible.
3. Drag the map and use the wheel and buttons. Coordinates and field of view should change.
4. Search for M42, then `10.684708, 41.268750`. Both should work without Sesame.
5. Search for an object outside the local list, such as `M81`. This requires Sesame and can fail during CDS service disruptions.
6. Switch between DSS2, 2MASS, and AllWISE and try alternate mirrors. Check imagery and credits. SDSS has partial sky coverage.
7. Switch projections, toggle the grid and local catalog, and visit M31 to check a known marker.
8. Copy the position and open the link in another tab. It should restore RA, Dec, field of view, projection, and survey.
9. At 390 px and 1440 px widths, check readability, keyboard operation, and access to controls.

The HiPS access indicator confirms that `properties` returned an expected HiPS field. Tile coverage, scientific quality, and future availability require separate checks.
