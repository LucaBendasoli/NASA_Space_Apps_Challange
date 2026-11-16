# Responsive chart width and series continuity

The chart follows the panel's actual width in compact and expanded modes. Expanding leftward takes 280 ms with `power3.out` easing and preserves the right edge, panel height, and Aladin view. Reversing mid-transition starts from the current visual width. Reduced motion applies the final size immediately.

The SVG `viewBox` uses the effective width with a stable height of 280 px on desktop, 190 px on mobile, and 156 px on short viewports. Axes, points, uncertainty bars, and paths are laid out for that space, making use of extra width without stretching text. On mobile, provenance fits on an ellipsized line with the full text still accessible, so the Expand and Compact labels do not shift the header height.

## Series continuity and data

- The primary object retains its SVG, paths, and points. Adding, removing, or replacing a comparison preserves the primary path and its animation state.
- Series are reconciled by survey, observation, and object. Points and uncertainties are keyed by band, and segments by the consecutive bands they connect. This applies to object and date comparisons.
- A new series gets its own line animation of about 460 ms and a short reveal of points and uncertainties. Any animation already running continues independently.
- Shared scales include uncertainty for every valid measurement. If a new series extends the scale, axes and positions update together to their final values. Tooltips and the table retain the original identities and values.
- Opening or reopening the panel, or changing the primary source, runs the full entrance animation. Theme, size, and repeated data responses leave completed paths in place.
- Choosing a comparison does not refetch the reference. The existing state modules still handle data access, caching, cancellation, and stale responses.

`chart-geometry.js` isolates domain calculation and projection. `science-chart.js` retains nodes by identity and observes SVG size with `ResizeObserver`. The callback uses the supplied dimensions and performs calculations and attribute writes without interleaved layout reads. It writes changed attributes only and disconnects on chart removal or teardown.

`panel-presentation.js` separates width, panel entrance, and series timelines. CSS width and position changes let content reflow. Using `scaleX` would distort text and scales. Reflow is confined to the fixed panel, leaving map size unchanged. The implementation avoids per-frame timelines, permanent `will-change`, and animation of measurement values. Removing a series cancels its timeline. Closing, teardown, and changing reduced-motion preference clean up animations. Size and data apply immediately if GSAP is unavailable.

## Validation performed

- `npm.cmd test` passed **57 tests**, including four new cases covering responsive geometry, shared scales, zero, negatives, missing values, uncertainties, single bands, and projection at different sizes.
- `npm.cmd run verify:upstream` verified **429/429 files**. `git diff --check` passed.
- Real Edge with official Aladin and the explicit demo showed the panel expanding from about 534 to 748 px at a constant height of 650 px. SVG width grew from 490 to 704 px and first-to-last point distance from 372 to 567 px. Intermediate widths, compact restoration, and a fixed right edge were observed. Map geometry stayed identical.
- When expansion was reversed, width was about 710 px immediately before and after the reversal. The first action was a real click. The reverse action ran in the same JavaScript turn to measure the handler boundary precisely.
- Adding object and date comparisons preserved the same SVG and primary path and point. The primary path kept opacity 1, an undashed stroke, and zero style mutations while the new series showed an intermediate `stroke-dashoffset` of about 0.85. Removing an empty comparison and loading a cached one also preserved the reference.
- Intercepted test responses delayed by 550 ms left the reference visible during and after fetch. Rescaling preserved the original tooltip value. The counters recorded one request per dataset (`a@now`, `b@now`, `a@old`) even after removing and reselecting a comparison.
- The run covered 1440×900 desktop, 390×844 mobile, dynamic reduced motion, object and date switching, and width reversal. On mobile the SVG occupied y=639–829. `scrollX/scrollY` stayed `[0,0]`, with no automatic scrolling. No local JavaScript or `ResizeObserver` errors appeared.

Captures are `output/playwright/fluid-chart-expanded.png`, `fluid-chart-temporal.png`, and `fluid-chart-mobile.png`. Local scripts are in the same Git-ignored directory. In-memory instrumentation exposed the real Aladin instance while retaining its renderer.

HTTP was intercepted and the demonstration used simulated data. External HiPS DNS failures and timeouts left a dark background in screenshots. The verified scope excluded a real science backend, alignment over loaded tiles, physical devices, screen readers, and FPS on low-performance hardware. This historical run did not include a commit or push.
