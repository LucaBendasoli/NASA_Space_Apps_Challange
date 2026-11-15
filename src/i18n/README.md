# Interface languages

The site uses `pt-BR.js`, `en.js` and `es.js`, with matching keys and interpolation parameters such as `{query}`. English is the default. The `orbita-language` localStorage entry restores a valid saved preference. Browser language does not override this default. If storage is blocked, switching still works for the current visit.

`index.js` exposes `t(key, parameters)`, `getLanguage()`, `setLanguage(locale)` and `onLanguageChange(callback)`. It updates `html.lang`, the document title, accessible labels and a live announcement. It never reloads the page or initializes the viewer.

In HTML, use `data-i18n="key"` on an element with one text node. For text mixed with icons, links or code, `data-i18n-nodes` maps child text-node indexes to keys. This preserves the existing nodes, whitespace and event handlers. Attributes use `data-i18n-aria-label`, `data-i18n-title`, `data-i18n-placeholder` or `data-i18n-content`. Do not replace containers using `innerHTML` to translate them.

Dynamic map messages retain their translation key and parameters so an active notice or error changes language immediately. The app's language subscription updates labels without calling navigation, zoom, projection or layer methods. Provider error messages are mapped to our own explanatory messages.

The reusable spectral chart accepts `locale` and `messages`. Its `update(props, { resetState: false })` option translates an existing instance while preserving its React root, series selection and spectral filters. Omitting that option retains the original behavior of resetting the chart for a new dataset. The chart's default messages keep it usable independently of the site.

Mission names, acronyms, IDs, URLs, coordinate values and scientific units remain unchanged. Local descriptive object names can be translated while their identifiers and measurements stay intact. Image tiles, external tools and native third-party viewer content (including provider credits and metadata) retain the provider's wording. These are not rewritten by the site's translator. Browser/system dialog chrome also follows the browser's own language.

Add keys to all three catalogs when extending the interface, then run `npm.cmd test`, `npm.cmd run typecheck:spectrum` and `npm.cmd run build:spectrum`. No translation service or additional runtime dependency is used.
