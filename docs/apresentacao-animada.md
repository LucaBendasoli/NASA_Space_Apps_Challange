# Animated presentation of measurements

The charts later gained an [animated guide line](linha-animada.md). The notes below describe the earlier point-only reveal.

## Behavior and architecture

The panel is a single non-modal region fixed to the viewport. On desktop, it is up to 560 px wide, capped at 46% of the available map width, with an 18 px margin. On open, `world2pix` helps choose the side that overlaps the selected source least. That side stays fixed until closing, with map controls on the opposite side. Camera, coordinates, field of view, and projection stay in place.

Compact mode uses the original width. **Expand** adds up to 40%, bounded by 860 px and the available space to the left. The right edge, vertical position, and height stay fixed. **Compact** restores the original geometry. The transition takes 280 ms, and the SVG uses the available width at a stable height. Text, existing series, their animation state, Aladin size, and selections are preserved. See [responsive geometry and series animation](grafico-responsivo.md).

On mobile the bottom panel uses a solid surface, safe-area spacing, a persistent heading, a chart, and internal scrolling. When it already fills the available width, Expand is disabled and its title explains the limit. The table and details stay accessible through internal scrolling. The panel has no drag gesture competing with the map. Short landscape layouts use a compact chart and adjusted SVG typography.

- `presentation-state.js` stores open, closed, and expanded state independently of requests.
- `panel-presentation.js` handles positioning, focus origin, Escape, timelines, motion preferences, and cleanup.
- `science-panel.js` and `science-view.js` preserve the heading, buttons, selector, and details across state updates. Chart and table data are replaced as a unit by object, survey, and observation key.
- `science-chart.js` places points at their final scientific coordinates. This stage used discrete points without connecting lines, interpolation, or animated values.
- `science-state.js` retains caching, cancellation, and request versioning. Cache hits return ready or empty state immediately.

Selecting a source opens the panel, updates its name synchronously, and starts the request immediately. Loading reserves chart space. Explicit actions open the panel, and arriving responses leave its open or closed state intact. Switching sources removes the previous chart before updating the data area. Closing retains the cache, so selecting the same source again can reopen it.

## Motion

GSAP **3.13.0**, served locally from `vendor/gsap.min.js` (about 72 kB uncompressed), handles SVG sequencing, interruptions, and timelines. No framework or additional GSAP plugins were added. Origin, version, and SHA-256 are in `vendor/gsap-runtime.json`. The README and license reference are in the same directory. Aladin manifests and source were untouched.

- Desktop entrance takes 270 ms, moving horizontally by 20 px and fading with `power3.out`.
- Mobile entrance takes 340 ms, moving vertically by 28 px and fading.
- Closing takes 180 ms. Content takes 150 ms, followed by slightly overlapping axes and marks. The reveal ends at about 370 ms.
- Points and uncertainty bars fade in at their final positions, with radiance values held constant.
- Interrupting a transition cancels its tween and resumes from the current visual state. `will-change` applies only while the container moves. The animation avoids per-frame layout reads and writes or continuous Aladin resizing.
- `gsap.matchMedia` tracks viewport and reduced motion. Changing the preference ends active motion and immediately displays the final state. The presentation is immediate and functional without GSAP.

## Accessibility

The source title labels the region, which leaves focus and the sky available. **Open measurements** and the **Go to analysis** link offer keyboard entry with `preventScroll`. Close, Expand, Compact, and the table controls are native. The Escape handler yields to a select or input, a higher-priority dialog, or the controls drawer. Closing from inside returns focus to its valid origin, or to the toolbar after canvas selections. The closed panel is `inert`, outside the accessibility tree, and does not capture clicks. Short selection, loading, and error announcements are separate from the SVG and table.

## Design references

- The browser panel adapts contextual sheet presentation to a non-modal region. [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- Immediate response, easing, and brief motion informed the transitions. This implementation uses no React or panel dragging. [Building a drawer component](https://emilkowal.ski/ui/building-a-drawer-component) · [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
- Visual hierarchy and a brief reveal were applied to discrete bands. [Carbon Choreography](https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography) · [Simple Charts](https://www.carbondesignsystem.com/building-blocks/data-visualization/simple-charts)
- Stable containers and explicit identities keep scales, marks, and titles coherent when switching data. [Bostock — Object Constancy](https://bost.ocks.org/mike/constancy/)
- Viewport boundaries, focus origin, and non-modal presentation informed the panel without adding Radix as a dependency. [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover)
- Live motion preference handling and focus access guide accessibility. [W3C — Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- Media conditions and animation cleanup use [gsap.matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/).

The historical run applied frontend-design, gsap-core, gsap-timeline, gsap-performance, svg-animation, and accessible-animation and used Playwright CLI for browser checks.

## Validation performed

Edge used Aladin 3.9.0-beta and real WebGL on `feat/selecao-astros-infravermelho`. This historical run did not include a commit or push.

- `npm.cmd test` passed **25 tests**, including independent presentation state, closing during load, immediate cache hits, and stale responses after reopening with a different identity.
- `npm.cmd run verify:upstream` verified all **429 files**, and `git diff --check` passed.
- The explicit demo covered clicking native marker A, selecting B by keyboard, a source without measurements, reopening the same source, expanding, and using the table. Button nodes stayed identical across updates.
- Selection preserved `scrollX/scrollY` and RA, Dec, and field of view. The panel, title, and chart stayed inside 1440×900, 390×844, and 844×390 viewports without horizontal overflow.
- Escape with focus on Close returned focus to the toolbar. Closing mid-entrance kept the panel closed. Changing reduced motion while open resulted in `transform: none`. Light and dark themes were exercised.
- Zoom, MOL projection, and dragging retained navigation and panel placement. Survey changes cleared incompatible charts, and switching only the mirror preserved scientific identity.
- Controlled browser HTTP responses used delays of 900 ms (A), 550 ms (B), and 120 ms (C). After A→B→C, only C and its key appeared. Switching back to A showed its heading and placeholder while loading. Closure persisted when a response arrived, and reopening used the cache. HTTP 503 showed an error and retry recovered the data. Partial coverage was preserved.
- Deliberately blocking GSAP left selection and charts usable.

Git-ignored scripts and captures include `output/playwright/animated-panel-check.js`, `panel-network-check.js`, `animation-mid.png`, `animated-desktop.png`, `animated-mobile.png`, `animated-landscape.png`, and `*-final.png`. Instrumentation exposed the real Aladin instance only to read `world2pix` and camera values.

## Observed limits

The session used mobile viewports and emulated reduced motion, changing the preference while the app ran. It did not exercise a real science backend, physical mobile device, or screen reader. Playwright could not find `ffmpeg-win64.exe` for video capture. Static screenshots include an intermediate reveal frame.

External HiPS imagery could be slow. One `Allsky.jpg` took around 26 seconds and returned HTTP 200. Some screenshots show sources against a black background while imagery loaded. The remote Aladin logger failed DNS, and the official fallback supplied the absent optional local bundle. WebGL was available. Scientific quality and ongoing HiPS availability were outside the test scope. External resources required switching a navigation wait from `waitUntil: load` to `domcontentloaded`. No formal FPS measurement was made.
