# Features

| Feature | Public tool or documentation | Órbita demonstration |
| --- | --- | --- |
| Sky imagery | Progressive HiPS levels | Official library with a direct mirror URL |
| Navigation and zoom | Mouse, touch, and API | Native gestures and custom buttons that call `increaseZoom` and `decreaseZoom`, like the official controls |
| Name search | Remote astronomical name resolution | Eight local targets, with Sesame for other names |
| Position search | Coordinate API | Two decimal numbers in ICRS degrees |
| Coordinates | Multiple reference frames and formats | Center RA and Dec in ICRS degrees |
| Surveys | Extensive list and layer selection | DSS2, 2MASS, AllWISE, and SDSS9 |
| Mirrors | The public page offers alternate providers | Selectable ESA and China-VO mirrors |
| Projections | Multiple engine projections | SIN, AIT, and MOL |
| Grid | Coordinate grid | Toggle through `setCooGrid` |
| Catalogs | SIMBAD, VizieR, local catalogs, and others through the API | Local list of eight objects with approximate positions |
| CSV and VOTable | Controls on the public page | Unavailable in this demo |
| FITS, MOC, and SAMP | Features in the code and API | Unavailable in this interface |
| Sharing | State and sharing API | Custom link with position, field of view, projection, and layer |

## Usage

- Enter `M31`, `M42`, `M45`, `Sirius`, `M51`, `M13`, `M1`, or `Sgr A*` to find a local target. Local targets use fixed, approximate coordinates without proper-motion corrections.
- Enter `10.684708, 41.268750` or `83.822083 -5.391111` to navigate without remote name resolution. Use a period as the decimal separator and a comma or space between the values. The custom parser handles decimal degrees.
- Switch surveys to compare bands. The providers supply color composites, which may differ from what the human eye would see.
- If images fail to appear, switch mirrors and check the metadata link. SDSS has partial sky coverage.
- Enable reference objects to see markers within the current field. The markers come from the local list.
- Use **Copy position** to save the current state as a link. If clipboard access fails, copy from the address bar. The link excludes the mirror, grid, and catalog visibility settings.

## Error handling

The site reports loading, library or WebGL failure, search timeout, and mirror access errors. The retry button reloads the page. A successful metadata request only confirms access to metadata. The demo has no offline science renderer or custom survey cache.

The controls were implemented and reviewed against the imported API source. See [validation notes](validacao.md) for the scope of browser testing at this stage.

## Zoom and resolution

The artificial 0.01° limit was removed. The engine determines zoom limits for the selected projection. Its minimum field was about 0.1 arcseconds in this version. Buttons use native engine animation, and gestures use native input handling.

Field size is displayed in degrees (°), arcminutes (′), or arcseconds (″). Coordinates use eight decimal places for readability at high zoom, with the original data precision intact. Links retain the numerical RA, Dec, and field of view without rounding small fields to zero. Positive field values from links go to the engine, which applies its own limits.

Each survey has a finite maximum resolution. Zooming beyond its highest level of detail enlarges existing pixels.

## Interface updates during navigation

Position and zoom events schedule one pending panel update through `requestAnimationFrame`, capped at 10 updates per second. The update reads the latest state when it runs and includes the final position after movement. An idle panel has no continuous loop. Nodes are stored once and text is written only when it changes. Hiding the tab cancels pending panel work, and returning requests a fresh update.

The Aladin options `showFov` and `showCooLocation` are disabled to avoid duplicate indicators and listeners. The original status bar and attribution remain available. CSS containment on the map and footer limits layout and painting propagation, and their numeric displays use tabular figures.

The cap applies only to the auxiliary panel. The engine still handles map frames and gestures, and survey mirrors and network conditions determine image download performance. This session did not measure FPS or GPU time.
