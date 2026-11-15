"""Run the existing detector on a six-arcminute field centered on the map."""
from collections import OrderedDict
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
import time

from astropy import units as u
from astropy.coordinates import SkyCoord
import numpy as np
from astropy_healpix import HEALPix
import requests

from acquire import acquire
from process import process_field

GRID = HEALPix(nside=32, order='nested')
RUN_LOCK = Lock()
ARCHIVE = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/hips5_cube/hips_20261026'
IMAGE_END = 106963967
CUBE_CACHE = TemporaryDirectory(prefix='atlas-cubes-')
CACHED_CUBES = OrderedDict()


ROOT = Path(__file__).resolve().parent
VERSION = sha256(ARCHIVE.encode() + b''.join(
    (ROOT / name).read_bytes() for name in
    ('live_scan.py', 'detector.py', 'process.py', 'acquire.py', 'channels.json')
)).hexdigest()[:16]
RESULTS = ROOT / '.eyelid' / 'scans' / VERSION


def saved_scans():
    return [json.loads(path.read_text()) for path in sorted(RESULTS.glob('*.json'))]


def scan(ra, dec):
    key = f'{ra:.5f}_{dec:.5f}'
    path = RESULTS / (key + '.json')
    with RUN_LOCK:
        if path.exists():
            return json.loads(path.read_text())
        result = run_scan(ra, dec)
        result['key'] = key
        RESULTS.mkdir(parents=True, exist_ok=True)
        pending = path.with_suffix('.tmp')
        pending.write_text(json.dumps(result, allow_nan=False))
        pending.replace(path)
        return result


def run_scan(ra, dec):
    with TemporaryDirectory(prefix='atlas-scan-') as work:
        work = Path(work)
        def fetch_cube(tile):
            if tile in CACHED_CUBES:
                CACHED_CUBES.move_to_end(tile)
                return CACHED_CUBES[tile]
            url = f'{ARCHIVE}/Norder5/Dir{tile//10000*10000}/Npix{tile}_cube.fits'
            path = Path(CUBE_CACHE.name) / f'tile-{tile}.fits'
            start = time.monotonic()
            with requests.get(url, headers={'Range': f'bytes=0-{IMAGE_END}'},
                              timeout=(12, 90), stream=True) as response:
                response.raise_for_status()
                if response.status_code != 206:
                    raise ValueError('IRSA não retornou o intervalo FITS solicitado')
                with path.open('wb') as output:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        output.write(chunk)
            if path.stat().st_size != IMAGE_END + 1:
                raise ValueError('Cubo SPHEREx incompleto')
            CACHED_CUBES[tile] = ('cube.bin', path, time.monotonic() - start, url)
            return CACHED_CUBES[tile]

        center = int(GRID.lonlat_to_healpix(ra * u.deg, dec * u.deg))
        acquire(('field', ra, dec, center), work, fetch_cube)
        try:
            result, _ = process_field('field', ra, dec, work / 'field', include_image=False)
        except ValueError as error:
            if not str(error).startswith('Cobertura SPHEREx'):
                raise
            east, north = np.meshgrid(np.linspace(-.052, .052, 21),
                                      np.linspace(-.052, .052, 21))
            corners = SkyCoord(ra * u.deg, dec * u.deg).spherical_offsets_by(east*u.deg, north*u.deg)
            tiles = set(GRID.lonlat_to_healpix(corners.ra, corners.dec).flat) - {center}
            if not tiles:
                raise
            adjacent = [fetch_cube(int(tile))[1] for tile in tiles]
            result, _ = process_field('field', ra, dec, work / 'field',
                                      extra_cubes=adjacent, include_image=False)
        while len(CACHED_CUBES) > 4:
            _, (_, path, _, _) = CACHED_CUBES.popitem(last=False)
            path.unlink()
        return dict(rows=result['rows'], radiance=result['radiance'], center=result['center'])
