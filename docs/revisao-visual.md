# Visual review of the charts and observation workspace

The review retained HTML, ES modules, SVG, GSAP, and official Aladin Lite. Measurements, science contracts, caches, and series identities stayed the same.

## Changes

- The radiance title aligns with the grid. Bottom spacing separates tick labels from the wavelength title. Tick count follows the available height, and negative exponents get extra margin.
- The legend, context, chart, and notes use consistent alignment and spacing. Background imagery and the science dataset are identified separately.
- The table stays open, with intact headers, right-aligned numbers, and units on a dedicated second line. Full values remain available. When columns overflow, the region scrolls horizontally by touch or keyboard within the page.
- Observation and coordinate details follow the table in an always-open list. Full IDs, coordinates, and ISO dates are preserved.
- Search, side controls, and sharing have clearer text and focus indicators. The mobile menu uses one column, and the header reserves room for buttons at larger text sizes.
- Short landscape layouts use compact controls and fewer chart ticks. Details scroll internally. Very large text may require internal scrolling to reach the chart.
- The native Aladin loading notice follows map contrast and leaves room for the image notice in landscape. Upstream files stayed untouched.
- Opening the About dialog or controls menu preserves the analysis when focus moves.

## Validation performed

Microsoft Edge ran through Playwright with real Aladin and the explicitly selected demo provider (`?science=demo`). Test instrumentation exposes the instance only to locate sources with `world2pix`, and actual mouse clicks target the canvas.

Checks covered opening one series, object and date comparisons, preserving the SVG and main path when adding comparisons or expanding, the table and metadata, dialog and focus behavior, Escape, keyboard mode switching, the mobile menu, and reopening with reduced motion. Viewports were 1440 × 900, 390 × 844, and 844 × 390. The 200% text check used CSS root font size. Native browser zoom and assistive technology were outside that check.

The visual flow completed 21 checks. Nine more covered first access with the provider off, explicit demo activation, search focus, local and coordinate search, grid and educational catalog controls, mirror switching within a survey, the shared URL, and Escape closing the dialog. These checks exercised the UI controls while tile availability remained unverified.

The title and chart stayed within the mobile viewport, and the compact chart fit inside the panel in landscape. `scrollX` and `scrollY` stayed at zero and the page had no horizontal overflow. An isolated fixture with negative radiance of order 10⁻¹² and small wavelengths checked SVG label bounds without clipping.

Captures are under `output/playwright/polish-*.png`, including light and dark desktop and mobile, expanded layout, table, metadata, landscape, and enlarged text. The local scripts are in the same Git-ignored directory.

Unit tests cover margins, grid density, scales, value preservation, selection, comparison, and concurrency. `npm.cmd test` passed 59 tests, `npm.cmd run verify:upstream` verified all 429 files, and `git diff --check` passed.

## Observed limits

External image servers returned `ERR_NAME_NOT_RESOLVED`, timeouts, and 404s. Native markers and charts rendered, while checking the final layout against loaded HiPS imagery remained pending. During a resize sequence with imagery unavailable, Aladin reported a 180° vertical field and correctly triggered the wide-query guard. The independent enlarged-text test reset the view. The test retained the engine's reported geometry.

The review used simulated data for the demo and axis fixture. It did not exercise a real science backend, physical device, or screen reader.
