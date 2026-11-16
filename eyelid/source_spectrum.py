"""Measure local-background-subtracted radiance in the SPHEREx DR1 mosaic."""
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore
from time import monotonic

from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS
from astropy_healpix import HEALPix
import numpy as np
import requests
from scipy.ndimage import map_coordinates

from live_scan import ARCHIVE, IMAGE_END

GRID = HEALPix(nside=32, order='nested')
WORKERS = BoundedSemaphore(2)
CELESTIAL_WCS = ('CTYPE1', 'CTYPE2', 'CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2',
                 'CUNIT1', 'CUNIT2', 'PV2_1', 'PV2_2', 'LONPOLE', 'LATPOLE',
                 'RADESYS', 'CD1_1', 'CD1_2', 'CD2_1', 'CD2_2',
                 'PC1_1', 'PC1_2', 'PC2_1', 'PC2_2', 'CDELT1', 'CDELT2')


def download_cube(tile, directory, deadline=None):
    url = f'{ARCHIVE}/Norder5/Dir{tile//10000*10000}/Npix{tile}_cube.fits'
    path = directory / f'{tile}.fits'
    with requests.get(url, headers={'Range': f'bytes=0-{IMAGE_END}'},
                      timeout=(6, 18), stream=True) as response:
        response.raise_for_status()
        if response.status_code != 206:
            raise ValueError('Expected a partial FITS response')
        with path.open('wb') as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                output.write(chunk)
    if path.stat().st_size != IMAGE_END + 1:
        raise ValueError('Incomplete SPHEREx cube')
    return path


def measure_spectrum(ra, dec, cube_path):
    axis = np.arange(-10, 11) * 3
    east, north = np.meshgrid(axis, axis)
    radius = np.hypot(east, north)
    aperture = radius <= 9
    background = (radius >= 18) & (radius <= 30)
    coordinates = SkyCoord(ra * u.deg, dec * u.deg).spherical_offsets_by(
        east * u.arcsec, north * u.arcsec)
    tiles = GRID.lonlat_to_healpix(coordinates.ra, coordinates.dec)
    samples = np.full((102, *tiles.shape), np.nan)
    for tile in np.unique(tiles[aperture | background]):
        path = cube_path(int(tile))
        with fits.open(path, ignore_missing_end=True) as hdus:
            image = hdus['IMAGE']
            header = image.header.copy()
            offset = image.fileinfo()['datLoc']
        wcs = WCS({key: header[key] for key in CELESTIAL_WCS if key in header})
        mask = (tiles == tile) & (aperture | background)
        x, y = wcs.all_world2pix(coordinates.ra.deg[mask], coordinates.dec.deg[mask], 0)
        cube = np.memmap(path, dtype='>f4', mode='r', offset=offset, shape=(102, 512, 512))
        for channel, plane in enumerate(cube):
            if channel not in (50, 51):
                samples[channel, mask] = map_coordinates(plane, [y, x], order=1, cval=np.nan)
    values = []
    for plane in samples:
        core = plane[aperture & np.isfinite(plane)]
        sky = plane[background & np.isfinite(plane)]
        values.append(round(float(core.mean() - np.median(sky)), 7)
                      if core.size >= 10 and sky.size >= 30 else None)
    return values


@lru_cache(maxsize=512)
def spectrum(ra, dec):
    if not WORKERS.acquire(blocking=False):
        raise BlockingIOError('SPHEREx spectrum workers are busy')
    try:
        deadline = monotonic() + 45
        with TemporaryDirectory(prefix='eyelid-spectra-') as work:
            return measure_spectrum(ra, dec, lambda tile: download_cube(tile, Path(work), deadline))
    finally:
        WORKERS.release()
