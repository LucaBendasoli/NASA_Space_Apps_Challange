"""Package Gaia measurements and astrometrically registered display FITS."""
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image

DIST = Path(__file__).resolve().parent / 'dist'
MOSAIC_EPOCH = 2025.75


def optional_number(value):
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return number if math.isfinite(number) else None


def package_region(region, cache):
    folder = DIST / 'observacoes' / region
    catalog = cache / 'catalog'
    header = fits.getheader(catalog / 'SPX001.fits')
    wcs = WCS(header)
    names = sorted(catalog.glob('SPX*.fits'))
    cube = np.stack([fits.getdata(name) for name in names])
    channels = [int(name.stem[3:]) for name in names]
    yy, xx = np.indices(cube.shape[1:])
    sources = []
    radiance = {}
    with (cache / 'gaia.csv').open() as handle:
        for row in csv.DictReader(handle):
            ra, dec = float(row['ra']), float(row['dec'])
            pmra, pmdec = (optional_number(row[k]) for k in ('pmra', 'pmdec'))
            gra, gdec = ra, dec
            if pmra is not None and pmdec is not None:
                years = MOSAIC_EPOCH - 2016
                gra += years * pmra / (3.6e6 * math.cos(math.radians(dec)))
                gdec += years * pmdec / 3.6e6
            x, y = wcs.world_to_pixel_values(gra, gdec)
            if not (-10 <= x <= 130 and -10 <= y <= 130):
                continue
            source_id = row['source_id']
            sources.append(dict(id='Gaia ' + source_id, ra=ra, dec=dec, pmra=pmra,
                                pmdec=pmdec, mag=optional_number(row['phot_g_mean_mag'])))
            radius = np.hypot(xx - x, yy - y) * 3
            core = cube[:, radius <= 9]
            sky = cube[:, (radius >= 18) & (radius <= 30)]
            values = [None] * 102
            for channel, aperture, background in zip(channels, core, sky):
                aperture = aperture[np.isfinite(aperture)]
                background = background[np.isfinite(background)]
                if aperture.size >= 10 and background.size >= 30:
                    values[channel - 1] = round(float(aperture.mean() - np.median(background)), 7)
            radiance['Gaia ' + source_id] = values
    (DIST / (region + '-gaia.json')).write_text(json.dumps(
        dict(sources=sources, radiance=radiance, epoch=MOSAIC_EPOCH), separators=(',', ':'), allow_nan=False))
    for path in folder.glob('*.png'):
        # Undo the display PNG's vertical flip to restore FITS pixel orientation.
        with Image.open(path) as image:
            pixels = np.asarray(image.convert('L'))[::-1]
        fits.writeto(path.with_suffix('.fits'), pixels, header, overwrite=True)
    print(region, len(sources), len(list(folder.glob('*.fits'))), flush=True)


if __name__ == '__main__':
    for field in ('campo-c03', 'campo-hercules', 'campo-leao'):
        package_region(field, Path(sys.argv[1]) / field)
