# Eyelid

## For NASA Space Apps judges

**[Open Eyelid as a judge →](https://nasaspaceapps.eyelid.com.br/jurados)**

The link signs you into the demo automatically and opens the sky map. Open **Saved regions**, select **Barnard’s Star**, and use **▶ Dates** to compare prepared SPHEREx images. The same list includes **Epsilon Indi B**, **WISE 0855**, **RW Aurigae**, and **R Draconis**.

## Run locally

Run these commands from this directory:

```sh
python3 -m pip install astropy astropy-healpix numpy scipy requests matplotlib pillow fsspec aiohttp
python3 serve.py
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) to sign in or create an account. For the local judges’ demo, open [http://127.0.0.1:8765/jurados](http://127.0.0.1:8765/jurados). Prepared images and object data are bundled with the app. The local server queries IRSA and Gaia DR3 for the visible region when needed.

Accounts and sessions are stored in SQLite at `.eyelid/accounts.sqlite3`. Set `EYELID_ACCOUNTS_DB` to use another persistent path. The judges’ link creates a separate browser session under the shared, read-only demo profile. On a public domain, the browser uses a secure session cookie and the reverse proxy must preserve the site’s `Host` header.

## Images, dates, and channels

Aladin Lite 3.8.2 uses the all-sky SPHEREx DR1 mosaic. The service worker fetches tiles for the selected channel from IRSA. The mosaic requires a network connection and a secure context such as localhost or HTTPS. Prepared cutouts load locally. In other regions, the viewer searches DR1 and QR3 exposures near the viewport center and uses spectral calibration to determine the channel.

**▶ Dates** keeps the current channel and plays available exposures chronologically. **▶ Channels** keeps the current date and cycles through the selected channels. The DR1 mosaic has data for 100 channels. Channels 51 and 52 have no mosaic data, and individual exposures cover different wavelength ranges.

To use previously downloaded exposures, start the server with:

```sh
EYELID_EPOCHS_DIR="$HOME/eyelid-data/epochs" python3 serve.py
```

Store the files under `epochs/<target>/cutouts/*.fits`. Each original FITS file must include the `IMAGE` extension, the observation time, and the WCS wavelength calibration. The local index reads the coordinates, date, and channel from the FITS file. IRSA handles requests where the local archive has no coverage. Keep `measurements.csv` and `summary.json` to audit acquisition and reuse the photometry.

## Catalog sources and candidates

Select a Gaia DR3 source or a screening candidate to open its object details. The Gaia overlay queries up to 500 of the brightest sources in the visible region. Where proper motion is available, the overlay estimates each Gaia source’s position on the selected observation date from epoch J2016.0, without applying parallax or radial velocity. Gaia apertures for the radiance curves use J2025.75 as the approximate mosaic epoch. Those curves are measured from the SPHEREx DR1 mosaic and remain independent of the exposure shown.

**Analyze map area** screens a 6′ × 6′ cutout centered on the view. The backend uses the SPHEREx FITS cube, WISE cutouts, and a Gaia catalog query without the overlay’s 500-source limit. Cubes are cached temporarily in the server process. The first field in a new tile requires a download of about 107 MB plus the WISE cutouts.

Completed analyses persist in `.eyelid/scans/` and reload with the map. Returning to a processed field reuses its results. The cache is versioned by the SPHEREx data and detector implementation.

## Rebuild the prepared data

[benchmark.json](benchmark.json) records the full processing run. To reproduce the prepared fields:

1. Run `acquire.py` and `process.py` with the same cache path.
2. Save IRSA SIA results as VOTable files, such as `campo-c03-spherex_dr1.vot`, then run `python3 epochs.py VOTABLE_DIR CACHE_DIR`. The script samples by month and detector, checks the wavelength calibration at the field center, and records each frame’s provenance.
3. Run `python3 gaia-assets.py CACHE_DIR` to prepare Gaia radiance curves and display FITS from the generated PNGs. These FITS preserve the sky coordinates for navigation and use the PNG display stretch.
4. Run `python3 build.py` to rebuild the app in `dist/`.

The viewer uses the cutouts in `dist/observacoes/`. Aladin Lite and its license are bundled in `dist/vendor/`.
