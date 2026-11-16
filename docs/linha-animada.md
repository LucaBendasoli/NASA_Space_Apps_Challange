# Animated guide line

Straight guide lines connect the bands. Individual markers still support tooltips and keyboard access, and uncertainty bars, values, units, and numerical positions are preserved. The line represents a visual connection between discrete measurements and uses no smoothing.

`chart-trace.js` sorts bands and breaks the line at missing or non-finite values. Only runs of at least two measurements produce a path. Isolated measurements remain visible on their own. The frontend neither creates nor infers bands missing from the payload.

Each SVG path uses `pathLength=1`. GSAP reveals the line through `strokeDashoffset`, drawing it in about 460 ms with a brief 40 ms overlap with the axes. When there are several segments, drawing time is proportional to their length, and segments follow wavelength order. Measurement values and positions stay fixed throughout the animation.

The line replays when the panel opens, reopens, or changes objects, including on cache hits. The panel structure stays stable. Closing the panel or quickly switching objects cancels the previous timeline. Theme changes, resizes, and repeated state emissions leave the animation state intact. Reduced motion and unavailable GSAP both show the complete line immediately.

Two implementation details keep the animation smooth. `autoRound:false` prevents normalized offsets from 1 to 0 from being rounded to whole pixels. Omitting `vector-effect:non-scaling-stroke` keeps the normalized dash consistent with responsive scaling. The marker hit area stayed the same when the visible marker size was reduced.

## Validation

- `npm.cmd test` passed 38 tests covering sorting without mutation, zero and negative values, gaps, isolated measurements, and bounded animation timing.
- `npm.cmd run verify:upstream` verified all 429 upstream files. `git diff --check` passed.
- In Edge, using the site with explicitly selected demo data, testing covered opening, switching between A and B, reopening with identical geometry, rapid changes, closing mid-animation, a mobile viewport, and reduced motion. Offsets reached zero at completion, and reduced motion removed the dash.
- A follow-up inspection in Edge loaded the real chart, state, demo provider, and presentation modules in an isolated page. This let the test inspect the drawing independently of the HiPS network. After 200 ms of the tween, the offset was `0.6219`, with only the initial section drawn. Offsets of `0.9576` and `0.9693` were observed when switching or reopening. The final test script left the application-wide timeline running.
- Local screenshots excluded from Git include `output/playwright/line-isolated-start.png`, `line-isolated-mid.png`, `line-isolated-end.png`, `line-trace-desktop.png`, and `line-trace-mobile.png`. The test scripts were `line-trace-check.js` and `line-isolated-check.js`.

When testing resumed after an interruption, HiPS servers returned timeouts and DNS failures, leaving the region unavailable. The final isolated check therefore covered the SVG rendering and presentation. Image rendering, WebGL alignment, a real science backend, and physical-device behavior were outside that check. This historical check did not include a commit or push.
