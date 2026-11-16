# Observation and analysis workspace

The [animated floating panel](apresentacao-animada.md) superseded this split layout and preserves the map size when opening and closing. The decisions and measurements here describe the earlier layout.

## Interface decision

The previous workflow put analysis below a map that took up most of the viewport. Selecting a source required scrolling away from the sky. The workspace used CSS Grid so users could see imagery and measurements at once, with the map and telemetry on the left and analysis on the right. Aladin continued to handle projection, sources, images, and gestures.

The layout kept DM Sans, Space Grotesk, light paper `#f5f6f2`, ink `#1b2a32`, sky `#080f1a`, green `#b8efbd`, dark surface `#1b2b35`, and dark background `#111b25`. Scientific information took priority in the layout.

- **Focus on map / Open analysis** collapses or restores the panel while retaining selection. Clicking a source reopens analysis without moving the page.
- **Expand / Compact** provides more chart space while keeping the map visible.
- At widths up to 1100 px, controls move into a drawer. Escape and outside clicks close it. Focus moves to search on open and back to the toggle on close. Background content is inert while the drawer is open.
- At widths up to 760 px, the map and analysis share the viewport vertically. The analysis panel scrolls internally and keeps its heading visible.
- The responsive chart uses 440 × 280 SVG units, compact numeric labels, and explicit scientific units. It fits without horizontal page scrolling. Valid points use real wavelengths, uncertainty bars, and keyboard access.
- The table and metadata sit in expandable sections. The table scrolls horizontally when needed. The UI reports missing bands, incomplete results, and errors.
- Updates preserve focus, reading position, and the open table. Changing the source scrolls to the top only within analysis so the new chart is visible.

`src/workspace.js` manages layout. `science-state.js` continues to handle data. The change added no application framework, charting library, or dependencies. The design review applied frontend-design and web-design-guidelines to the project, and Playwright checked it in a browser.

## Validation

Edge used real Aladin and WebGL with an explicitly selected demo provider.

- Clicking native source A opened its chart without page scrolling.
- At 1440 × 900, the map was about 690 × 778 px and the chart 419 × 267 px, both within the viewport.
- At 390 × 844, the map was about 370 × 321 px and the chart 338 × 215 px. Expanded analysis retained about 209 px of map height.
- Keyboard selection switched to B. Collapsing and reopening preserved measurements. Tests also covered the expandable table, Escape closing the drawer, and theme switching.
- Neither viewport had horizontal or vertical page overflow. Local captures in `output/playwright/workspace-*.png` include `workspace-loaded.png` with rendered DSS imagery. The local test script is `output/playwright/workspace-check.js`.
- `npm.cmd test` passed 22 tests, and `npm.cmd run verify:upstream` verified all 429 official files.

A real science backend and physical touch device were outside the test scope. The external Aladin logger's DNS error did not prevent imagery from rendering. The measurements came from the demo provider.

## Follow-up

Comparison between the primary source and another visible source was implemented later. See [object comparison](comparacao-astros.md). Researcher validation and confirmation of the real science contract remain pending for this prototype.
