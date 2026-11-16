# Comparing objects on the same chart

Click a map marker to select the primary source. The chart starts with one green series for that source. The former primary source dropdown was removed. The **Compare with another visible object** dropdown sits below the heading next to **Pin analysis**, using the previous selector's style. It is available without expanding the panel or opening **Show more**. It starts at **Select another object to compare**. An explicit choice adds a purple series. The legend identifies each object, and the table and tooltips identify the corresponding series and band.

During primary loading, the comparison dropdown stays visible and disabled. Opening the panel by keyboard or through the shortcut focuses its labeled region without scrolling the page. If map markers overlap, the click opens a disambiguation choice so users can select the intended source.

The chart is followed by **Measurement table**, then **Observation and coordinates**. Both have accessible headings, and their contents remain open in the panel's scroll area as the object or comparison changes. The table appears when measurements are available, and identification appears when a source is selected.

The dropdown includes only other sources from the regional science catalog whose projected positions lie within the map's current width and height. Educational objects and uncataloged points are excluded. Partial queries remain labeled as such, and choices reflect the available records.

## Selection lifecycle

- A second source loads after an explicit choice. Select the first option to remove the comparison.
- Selecting a primary source, including the same source again, clears the comparison. Reopening the panel also starts with one series. Pinning keeps its existing behavior for the primary analysis.
- Navigation updates the available choices using their projected positions. The comparison is removed if its source leaves the field or regional catalog.
- Changing surveys or entering an incompatible context clears both series. A shared link restores only the primary selection.
- Missing measurements or errors in the comparison leave the primary analysis visible. Errors have a dedicated message and a retry action.

## Data and motion

`science-comparison.js` manages requests, cancellation, version counters, a bounded cache, and comparison state independently of the primary selection. Keys include the survey, observation, and identifier. Stale responses cannot restore a cleared or replaced series. Responses arriving after the panel closes leave it closed.

Both series share numerical axes based on all valid values and uncertainties. Wavelength and radiance unit strings must match after adapter normalization. The backend must supply compatible units. Existing provisional contracts and endpoints remain unchanged, and the chart uses no automatic conversion, amplitude normalization, or secondary axis.

Straight visual guides connect consecutive valid bands. Missing values break a line, zero and permitted negatives are preserved, and a single value stays isolated. Connecting the points gives a visual guide between discrete measurements.

Adding or replacing a comparison updates scale and coordinates together. The SVG and primary path remain in the DOM. Only the new series animates, over about 500 ms. Markers and uncertainties appear at their final coordinates, and the selector stays stable. Reduced motion shows the final state, even if the preference changes during interaction. Data remains visible when GSAP is unavailable. See [responsive width, series continuity, and validation](grafico-responsivo.md).

## Validation

State tests cover the initial single-series state, removal, available choices, out-of-order responses, resets during a request, scientific context, observation-keyed caching, incompatible units, empty responses, errors, and retries. Visual checks used explicitly simulated data.

This run passed **43 tests** with `npm.cmd test`, verified all **429 upstream files** with `npm.cmd run verify:upstream`, and passed `git diff --check`.

Microsoft Edge via Playwright CLI covered:

- Clicking a native Aladin marker, the initial series and exact placeholder, adding a second series with distinct colors, and ten demo bands in the table.
- Keyboard focus on the comparison tooltip highlighting only its row, even when two objects share a band identifier.
- A comparison with no measurements leaving the primary chart visible, repeated primary selection, reopening, and removing the comparison through the placeholder.
- Light and dark themes, switching to reduced motion with the panel open, and cleanup of line dashes.
- 1440×900 desktop and 390×844 mobile. The expanded mobile SVG occupied y=555–773, within the 844 px viewport. Horizontal overflow was absent and `scrollX/scrollY` stayed `[0,0]`.
- Zooming until other sources leave the field, removal of the comparison, and recovery of the available choices on zooming out. Switching SIN/AIT preserved a compatible comparison. The grid and educational catalog remained accessible. At 760×390, the panel scrolled internally without moving the page.
- Intercepted HTTP responses, separate from the demo, tested keyboard interaction, an 850 ms delay, a stale B response after switching to C, HTTP 503 and retry, incompatible units, closing during a request, and switching surveys. Line drawing was observed at an intermediate `stroke-dashoffset` of about 0.49.

Screenshots include `output/playwright/comparison-desktop.png`, `comparison-dark.png`, `comparison-mobile.png`, `comparison-reduced.png`, and `comparison-landscape.png`. Local scripts are in the same Git-ignored directory.

Edge used the real WebGL renderer and native markers. In-memory instrumentation of the entry module exposed the Aladin instance. HiPS tiles failed to load due to DNS errors and timeouts, and the official bundle also reported fetch errors. The screenshots show a dark map background. Alignment over loaded tiles, physical devices, screen readers, and a real science backend were outside the verified scope.

### Always-visible selector follow-up

After removing the primary selector and moving the comparison into the fixed controls, all 43 tests, the 429-file upstream verification, and `git diff --check` passed again. The Edge run confirmed a real click on A, an immediately visible comparison selector with no `details` ancestor, a second line without changes to the primary path, theme changes without recreating the control, a click on B restoring one line and the placeholder, and focus entering the panel. On 390×844, the selector occupied y=411–456 and the SVG y=558–776, without horizontal overflow or changes in `scrollX/scrollY`. Updated captures are `output/playwright/direct-comparison-desktop.png` and `direct-comparison-mobile.png`. This used the explicit demo, with the same network and backend limits.
