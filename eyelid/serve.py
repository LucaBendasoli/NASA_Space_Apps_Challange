"""Serve the Atlas and query public survey archives for the current field."""
import argparse
import base64
import csv
import gzip
from hashlib import sha256
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FutureTimeout
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import logging
import math
import os
import re
from pathlib import Path
import secrets
import shutil
from tempfile import TemporaryDirectory
from threading import Lock, local
import time
from urllib.parse import parse_qs, urlsplit

from astropy import log
from astropy.io import fits
from astropy.io.votable import parse
from astropy.time import Time
from astropy.wcs import WCS
from astropy.wcs.utils import proj_plane_pixel_scales
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
import requests

from accounts import auth_get, auth_post
from community import community_get, community_post
from align_epochs import align_images
from local_epochs import EpochArchive

ROOT = Path(__file__).resolve().parent
LOCAL_EPOCHS = EpochArchive(os.environ.get('EYELID_EPOCHS_DIR', ROOT / '.eyelid' / 'epochs'))
IRSA = 'https://irsa.ipac.caltech.edu'
IRSA_S3 = 'https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/'
WAVES = np.array(json.loads((ROOT / 'channels.json').read_text()))
CUTOUTS = ThreadPoolExecutor(12)
DETAIL_CUTOUTS = ThreadPoolExecutor(8)
INVENTORIES = ThreadPoolExecutor(6)
HISTORY_CUTOUTS = ThreadPoolExecutor(12)
HISTORY_CLIENTS = local()
HISTORY_LOCKS = [Lock() for _ in range(8)]
RGB_LOOKUPS = ThreadPoolExecutor(3)
FRAMES = {}
log.setLevel('ERROR')


def archive_url(path):
    url = path if path.startswith(IRSA + '/') else IRSA + '/' + path.lstrip('/')
    return url if url.startswith(IRSA + '/ibe/data/spherex/') else None


def tap_inventory(ra, dec, detector, radius=0):
    # The IRSA cutout tutorial uses the exposure footprint, then checks the
    # local wavelength inside the returned FITS.
    footprint = (f"INTERSECTS(CIRCLE('ICRS', {ra}, {dec}, {radius}), p.poly)"
                 if radius else f"CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)")
    query = f"""
        SELECT a.uri, p.time_bounds_lower
        FROM spherex.artifact a
        JOIN spherex.plane p ON a.planeid = p.planeid
        WHERE 1 = {footprint}
          AND p.energy_bandpassname = 'SPHEREx-D{detector}'
    """
    response = requests.get(IRSA + '/TAP/sync', params={
        'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': query
    }, timeout=28)
    response.raise_for_status()
    rows = csv.DictReader(response.text.splitlines())
    if not rows.fieldnames or not {'uri', 'time_bounds_lower'} <= set(rows.fieldnames):
        raise ValueError('Resposta TAP do IRSA inválida')
    return tuple(sorted({
        (float(row['time_bounds_lower']), url) for row in rows
        if (url := archive_url(row['uri']))
        and url.startswith((IRSA + '/ibe/data/spherex/dr1/', IRSA + '/ibe/data/spherex/qr3/'))
    }))


@lru_cache(maxsize=24)
def inventory(ra, dec, detector):
    errors = (requests.RequestException, ValueError, OSError)
    sia = INVENTORIES.submit(sia_inventory, ra, dec, detector)
    try:
        entries = sia.result(timeout=2)
        if entries:
            return entries
    except FutureTimeout:
        pass
    except errors as error:
        logging.warning('IRSA SIA inventory D%s: %s', detector, error)
        return tap_inventory(ra, dec, detector)

    tap = INVENTORIES.submit(tap_inventory, ra, dec, detector)
    empty = False
    last_error = None
    for future in as_completed((sia, tap)):
        try:
            entries = future.result()
        except errors as error:
            name = 'SIA' if future is sia else 'TAP'
            logging.warning('IRSA %s inventory D%s: %s', name, detector, error)
            last_error = error
            continue
        if entries:
            (tap if future is sia else sia).cancel()
            return entries
        empty = True
    if empty:
        return ()
    raise last_error


def sia_inventory(ra, dec, detector, radius=.001):
    response = requests.get(IRSA + '/SIA', params=[
        ('COLLECTION', 'spherex_dr1'), ('COLLECTION', 'spherex_qr3'),
        ('COLLECTION', 'spherex_dr1_deep'), ('COLLECTION', 'spherex_qr3_deep'),
        ('POS', f'CIRCLE {ra} {dec} {radius}'),
        ('BAND', f'{WAVES[(detector-1)*17]*1e-6} {WAVES[detector*17-1]*1e-6}')
    ], timeout=28)
    response.raise_for_status()
    table = parse(BytesIO(response.content)).get_first_table().to_table(use_names_over_ids=True)
    return tuple(sorted({
        (float(row['t_min']), str(row['access_url']))
        for row in table if str(row['energy_bandpassname']) == f'SPHEREx-D{detector}'
        and str(row['access_url']).startswith(IRSA + '/ibe/data/spherex/')
    }))


def inspect_cutout(job):
    ra, dec, size, stamp, url = job
    params = {'center': f'{ra},{dec}', 'size': size}
    response = requests.get(url, params=params, timeout=14)
    if response.status_code in (502, 503, 504):
        response.close()
        response = requests.get(url, params=params, timeout=14)
    response.raise_for_status()
    with fits.open(BytesIO(response.content)) as hdus:
        sample = sample_exposure(hdus, ra, dec)
        if not sample:
            return None
        channel, frame = sample
        content = render_exposure(hdus['IMAGE'])
    utc = Time(stamp, format='mjd').iso
    return channel, dict(frame, utc=utc, url=response.url), content


def sample_exposure(hdus, ra, dec):
    image = hdus['IMAGE']
    spatial = WCS(image.header).celestial
    x, y = map(float, spatial.world_to_pixel_values(ra, dec))
    height, width = image.shape
    if not (-.5 <= x < width-.5 and -.5 <= y < height-.5):
        return None
    if not np.isfinite(image.section[int(math.floor(y+.5)), int(math.floor(x+.5))]):
        return None
    spectral = WCS(image.header, fobj=hdus, key='W')
    spectral.sip = None
    wave, bandwidth = (float(value.to_value('um')) for value in spectral.pixel_to_world(x, y))
    if not math.isfinite(wave) or not math.isfinite(bandwidth) or bandwidth <= 0:
        return None
    channel = int(np.argmin(abs(WAVES - wave))) + 1
    if channel in (51, 52) or abs(WAVES[channel - 1] - wave) > bandwidth / 2:
        return None
    scale = round(float(np.mean(proj_plane_pixel_scales(spatial))) * 3600, 2)
    return channel, dict(channel=channel, wave=wave, width=bandwidth, pixelScale=scale)


def display_pixels(image):
    pixels = image.data.astype(float)
    finite = np.isfinite(pixels)
    lo, hi = np.percentile(pixels[finite], [30, 99.8])
    scaled = np.clip((pixels - lo) / max(hi - lo, 1e-10), 0, 1)
    scaled = np.arcsinh(np.where(finite, scaled, 0) * 12) / np.arcsinh(12)
    return np.uint8(255 * scaled)


def render_exposure(image):
    output = BytesIO()
    fits.writeto(output, display_pixels(image), WCS(image.header).celestial.to_header(relax=True))
    return output.getvalue()


@lru_cache(maxsize=16)
def archived_dates(ra, dec, entries):
    dates = {}
    for entry in entries:
        try:
            with fits.open(entry.path) as hdus:
                sample = sample_exposure(hdus, ra, dec)
        except (OSError, ValueError, TypeError, KeyError, IndexError) as error:
            logging.warning('Exposição local %s: %s', entry.path.name, error)
            continue
        if not sample:
            continue
        channel, frame = sample
        same_day = dates.setdefault(entry.utc[:10], {})
        existing = same_day.get(channel)
        if existing and abs(existing['wave'] - WAVES[channel-1]) <= abs(frame['wave'] - WAVES[channel-1]):
            continue
        same_day[channel] = dict(frame, utc=entry.utc, source='local',
                                 fits='/api/local-frame/' + entry.key, preview='/api/local-preview/' + entry.key,
                                 url='/api/local-original/' + entry.key)
    return dates


@lru_cache(maxsize=8)
def read_expanded_series(path, modified):
    return json.loads(path.read_text())


def expanded_dates(ra, dec):
    result = {}
    for path in (ROOT/'dist'/'expanded-epochs').glob('*/series.json'):
        if path.parent.name.startswith('sky-'):
            continue
        series = read_expanded_series(path, path.stat().st_mtime_ns)
        east = ((ra-series['ra']+540)%360-180)*math.cos(math.radians(series['dec']))
        if math.hypot(east, dec-series['dec']) > .008:
            continue
        for day, frame in series['frames'].items():
            result.setdefault(day, {})[series['channel']] = frame
    return result


def prepared_exposures(ra, dec, detector, exact_channel=None):
    exposures = set()
    for index in (ROOT / 'dist' / 'observacoes').glob('*/index.json'):
        field = json.loads((ROOT / 'dist' / (index.parent.name + '.json')).read_text())
        origin_ra, origin_dec = field['center']
        east = ((ra - origin_ra + 540) % 360 - 180) * math.cos(math.radians(origin_dec))
        if abs(east) > .06 or abs(dec - origin_dec) > .06:
            continue
        for frames in json.loads(index.read_text())['dates'].values():
            for channel, frame in frames.items():
                number = int(channel)
                if exact_channel is not None and number != exact_channel:
                    continue
                if (number - 1) // 17 + 1 == detector and frame['url'].startswith(IRSA + '/ibe/data/spherex/'):
                    exposures.add((float(Time(frame['utc'], format='iso').mjd), frame['url']))
    return sorted(exposures)


@lru_cache(maxsize=12)
def find_exposures(ra, dec, size, detector):
    dates = {}
    failures = 0
    try:
        exposures = inventory(ra, dec, detector)
    except (requests.RequestException, ValueError, OSError):
        exposures = prepared_exposures(ra, dec, detector)
        if not exposures:
            raise
        failures += 1
    jobs = [(ra, dec, size, stamp, url) for stamp, url in exposures]
    futures = [CUTOUTS.submit(inspect_cutout, job) for job in jobs]
    for future in futures:
        try:
            result = future.result()
        except (requests.RequestException, ValueError, OSError, KeyError, IndexError):
            failures += 1
            continue
        if result is None:
            continue
        channel, frame, content = result
        day = frame['utc'][:10]
        options = dates.setdefault(day, {})
        old = options.get(channel)
        if old and abs(old['wave'] - WAVES[channel-1]) <= abs(frame['wave'] - WAVES[channel-1]):
            continue
        options[channel] = store_frame(frame, content)
    return dict(dates=dates, failures=failures)


def history_sample(hdus, ra, dec, size, stamp, source, original=False):
    sample = sample_exposure(hdus, ra, dec)
    if not sample:
        return None
    _, frame = sample
    image = hdus['IMAGE']
    spatial = WCS(image.header).celestial
    if not original:
        pixels = np.array(image.data, dtype=np.float32)
    else:
        # The S3 mirror serves the original exposure. Read only the FITS window
        # via HTTP Range, while keeping the original WCS for the cropped pixels.
        x, y = map(float, spatial.world_to_pixel_values(ra, dec))
        scale = float(np.min(proj_plane_pixel_scales(spatial)))
        half = math.ceil(size / (2 * scale))
        window = (
            slice(max(0, round(y) - half), min(image.shape[0], round(y) + half + 1)),
            slice(max(0, round(x) - half), min(image.shape[1], round(x) + half + 1)),
        )
        pixels = np.array(image.section[window], dtype=np.float32)
        spatial = spatial.slice(window)
    utc = Time(stamp, format='mjd').iso
    return dict(day=utc[:10], frame=dict(frame, utc=utc), archiveUrl=source), spatial, pixels


def history_cutout(ra, dec, size, stamp, url):
    source = urlsplit(url)._replace(query='', fragment='').geturl()
    if not hasattr(HISTORY_CLIENTS, 'session'):
        HISTORY_CLIENTS.session = requests.Session()
    errors = (requests.RequestException, ValueError, OSError, KeyError, IndexError)
    for extent in dict.fromkeys((size, min(size, .12))):
        try:
            with HISTORY_CLIENTS.session.get(source, params={'center': f'{ra},{dec}d', 'size': extent},
                                             timeout=(6, 14)) as response:
                response.raise_for_status()
                with fits.open(BytesIO(response.content)) as hdus:
                    return history_sample(hdus, ra, dec, extent, stamp, response.url)
        except errors as error:
            last_error = error
    if source.startswith(IRSA + '/ibe/data/spherex/'):
        mirror = IRSA_S3 + source.split('/ibe/data/spherex/', 1)[1]
        try:
            import aiohttp
            with fits.open(mirror, use_fsspec=True, fsspec_kwargs={
                'block_size': 512 * 1024, 'client_kwargs': {'timeout': aiohttp.ClientTimeout(total=12)}
            }) as hdus:
                return history_sample(hdus, ra, dec, size, stamp, mirror, original=True)
        except errors + (ImportError,) as error:
            logging.info('Espelho SPHEREx: %s', error)
    raise last_error


def aligned_history(ra, dec, size, channel):
    # Versioned URLs keep the browser cache consistent when new data arrive.
    detector = (channel - 1) // 17 + 1
    key = sha256(repr((2, ra, dec, size, detector, int(time.time() / 86400))).encode()).hexdigest()[:24]
    root = ROOT / 'dist' / 'expanded-epochs'
    destination = root / ('sky-' + key)
    manifest = destination / 'series.json'
    key_lock = HISTORY_LOCKS[int(key[:2], 16) % len(HISTORY_LOCKS)]
    with key_lock:
        if manifest.is_file():
            series = json.loads(manifest.read_text())
            if not series['failures'] or time.time() - manifest.stat().st_mtime < 180:
                return history_result(series, channel, True)
        for attempt in range(2):
            try:
                exposures = inventory(ra, dec, detector)
                break
            except (requests.RequestException, ValueError, OSError):
                if attempt:
                    raise
        futures = [HISTORY_CUTOUTS.submit(history_cutout, ra, dec, size, stamp, url)
                   for stamp, url in exposures]
        best = {}
        failures = 0
        for future in futures:
            try:
                sample = future.result()
            except (requests.RequestException, ValueError, OSError, KeyError, IndexError) as error:
                logging.warning('Recorte temporal SPHEREx: %s', error)
                failures += 1
                continue
            if not sample:
                continue
            record = sample[0]
            frame = record['frame']
            band = frame['channel']
            day = record['day']
            by_date = best.setdefault(band, {})
            old = by_date.get(day)
            nominal = WAVES[band - 1]
            if old and abs(old[0]['frame']['wave'] - nominal) <= abs(frame['wave'] - nominal):
                continue
            by_date[day] = sample
        if failures and not best:
            raise OSError('Exposições do IRSA indisponíveis')
        root.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(dir=root) as staging:
            # Each refresh gets immutable frame URLs, including retries of a partial series.
            generation = destination.name + '-' + secrets.token_hex(4)
            series = dict(dates={}, bands={}, failures=failures)
            for band, by_date in best.items():
                name = f'{generation}-{band}'
                output = Path(staging) / name
                try:
                    aligned = align_images(list(by_date.values()), output, ra, dec, band,
                                           '/expanded-epochs/' + name, extent=size, minimum=3)
                except ValueError as error:
                    logging.warning('Grade temporal do canal %s: %s', band, error)
                    continue
                series['bands'][str(band)] = {key: aligned[key] for key in ('width', 'scale')}
                for day, frame in aligned['frames'].items():
                    series['dates'].setdefault(day, {})[band] = frame
            for output in Path(staging).iterdir():
                output.rename(root / output.name)
            destination.mkdir(exist_ok=True)
            staged_manifest = Path(staging) / 'series.json'
            staged_manifest.write_text(json.dumps(series))
            staged_manifest.replace(manifest)
        # Keep recent frames available during playback, even when a series was refreshed.
        cutoff = time.time() - 3 * 86400
        for old in root.glob('sky-*'):
            try:
                if old.stat().st_mtime < cutoff:
                    shutil.rmtree(old, ignore_errors=True)
            except FileNotFoundError:
                continue
        return history_result(series, channel, False)


def tiled_inventory(ra,dec,extent,detector):
    radius = round(extent * .89, 5)
    lookups = [INVENTORIES.submit(method,ra,dec,detector,radius)
               for method in (sia_inventory,tap_inventory)]
    last_error = None
    for lookup in as_completed(lookups):
        try:
            result = lookup.result()
            if result:
                return result, False
        except (OSError, ValueError, requests.RequestException) as error:
            last_error = error
    if last_error is None:
        return (), False
    # Retain the observations already discovered nearby when both services
    # are unavailable. The field catalog is incomplete in this mode.
    known = set()
    for path in (ROOT/'dist'/'expanded-epochs').glob('sky-*-*/series.json'):
        try:
            series = read_expanded_series(path, path.stat().st_mtime_ns)
        except FileNotFoundError:
            continue
        if (series['channel']-1)//17+1 != detector:
            continue
        east = ((ra-series['ra']+540)%360-180)*math.cos(math.radians(dec))
        if math.hypot(east, dec-series['dec']) > radius:
            continue
        for frame in series['frames'].values():
            url = frame['url']
            if url.startswith((IRSA_S3, IRSA+'/ibe/data/spherex/')):
                known.add((float(Time(frame['utc'],format='iso').mjd),url))
    if known:
        return sorted(known), True
    raise last_error


def tiled_history(ra,dec,extent,channel):
    from temporal_tiles import build_tiles
    detector = (channel - 1)//17 + 1
    def mirror(url):
        if url.startswith(IRSA_S3):
            return url
        return IRSA_S3 + urlsplit(url).path.split('/ibe/data/spherex/',1)[1]
    return build_tiles(ROOT/'dist'/'temporal-tiles',ra,dec,extent,channel,WAVES[channel-1],
                       lambda: tiled_inventory(ra,dec,extent,detector),HISTORY_CUTOUTS,mirror)


def history_result(series, channel, cached):
    return dict(dates=series['dates'], failures=series['failures'], cached=cached,
                coverage=series['bands'], **series['bands'].get(str(channel), {}))


def store_frame(frame, content):
    key = secrets.token_hex(12)
    if len(FRAMES) >= 750:
        FRAMES.pop(next(iter(FRAMES)), None)
    FRAMES[key] = content
    return dict(frame, fits='/api/frame/' + key)


@lru_cache(maxsize=48)
def native_component(ra, dec, channel):
    detector = (channel - 1) // 17 + 1
    size = .12
    known = prepared_exposures(ra, dec, detector, channel)
    for stamp, url in reversed(known):
        try:
            result = inspect_cutout((ra, dec, size, stamp, url))
        except (requests.RequestException, ValueError, OSError, KeyError, IndexError):
            continue
        if result and result[0] == channel:
            return result[1:]
    failures = 0
    try:
        candidates = inventory(ra, dec, detector)
    except (requests.RequestException, ValueError, OSError):
        candidates = prepared_exposures(ra, dec, detector)
        if not candidates:
            raise
        failures = 1
    exposures = sorted(set(candidates) - set(known), reverse=True)
    for first in range(0, len(exposures), 12):
        batch = [CUTOUTS.submit(inspect_cutout, (ra, dec, size, stamp, url))
                 for stamp, url in exposures[first:first + 12]]
        for future in as_completed(batch):
            try:
                result = future.result()
            except (requests.RequestException, ValueError, OSError, KeyError, IndexError):
                failures += 1
                continue
            if result and result[0] == channel:
                for pending in batch:
                    pending.cancel()
                return result[1:]
    if failures:
        raise ValueError('O IRSA não permitiu verificar todas as exposições')
    return None


@lru_cache(maxsize=64)
def native_preview(ra, dec, requested):
    """Find a useful exposure quickly, preferring the requested wavelength."""
    detectors = sorted(range(1, 7), key=lambda d: min(
        abs(WAVES[requested - 1] - wave) for wave in WAVES[(d - 1)*17:d*17]
    ))
    best = None
    incomplete = False

    def read_batch(exposures):
        nonlocal best, incomplete
        pending = [DETAIL_CUTOUTS.submit(inspect_cutout, (ra, dec, .12, stamp, url))
                   for stamp, url in exposures]
        for future in as_completed(pending):
            try:
                result = future.result()
            except (requests.RequestException, ValueError, OSError, KeyError, IndexError) as error:
                incomplete = True
                logging.info('IRSA cutout: %s', error)
                continue
            if not result:
                continue
            channel, frame, content = result
            if channel == requested:
                for other in pending:
                    other.cancel()
                return frame, content
            distance = abs(WAVES[requested - 1] - frame['wave'])
            if best is None or distance < best[0]:
                best = distance, frame, content
        return None

    # Download catalogued observations directly in known regions. Elsewhere,
    # discover footprints through IRSA before attempting any FITS transfers.
    expected = (requested - 1) // 17 + 1
    exact = prepared_exposures(ra, dec, expected, requested)
    match = read_batch(exact)
    if match:
        return match
    catalogued = {d:set(prepared_exposures(ra, dec, d)) - set(exact) for d in detectors}
    for detector in detectors:
        known = catalogued[detector]
        try:
            entries = set(inventory(ra, dec, detector)) | known
        except (requests.RequestException, ValueError, OSError):
            if not known:
                if best:
                    return best[1:]
                if not any(catalogued.values()):
                    raise
                continue
            entries = known
            incomplete = True
        entries = sorted(entries - set(exact), reverse=True)
        for start in range(0, len(entries), 8):
            match = read_batch(entries[start:start + 8])
            if match:
                return match
            # Once useful nearby data arrives, surface it without waiting for
            # the full inventory. The UI identifies the actual channel.
            if best and (start >= 8 or len(entries) <= 8):
                return best[1:]
    if best:
        return best[1:]
    if incomplete:
        raise ValueError('O IRSA não permitiu verificar todas as exposições')
    return None


def compose_native_rgb(ra, dec, components):
    frames, contents = zip(*components)
    # Sample on the coarsest native grid of the three exposures.
    scale = max(frame['pixelScale'] for frame in frames)
    width = 2 * math.ceil(.04 * 3600 / scale) + 1
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.crpix = [(width + 1) / 2] * 2
    wcs.wcs.cdelt = [-scale / 3600, scale / 3600]
    wcs.wcs.radesys = 'ICRS'
    y, x = np.indices((width, width))
    world = wcs.pixel_to_world_values(x, y)
    bands = []
    for content in contents:
        with fits.open(BytesIO(content)) as hdus:
            hdu = hdus[0]
            sx, sy = WCS(hdu.header).world_to_pixel_values(*world)
            bands.append(map_coordinates(hdu.data.astype(float), [sy,sx], order=1, cval=np.nan))
    cube = np.stack(bands, axis=-1)
    valid = np.isfinite(cube).all(axis=-1)
    if not valid[width // 2, width // 2]:
        return None
    rgba = np.dstack((np.nan_to_num(cube).clip(0,255).astype(np.uint8), valid.astype(np.uint8)*255))
    png = BytesIO()
    Image.fromarray(rgba[::-1]).save(png, format='PNG')
    header = dict(wcs.to_header())
    header.update(NAXIS=2, NAXIS1=width, NAXIS2=width)
    return dict(image='data:image/png;base64,'+base64.b64encode(png.getvalue()).decode('ascii'),
                wcs=header, pixelScale=scale, dates=[frame['utc'][:10] for frame in frames])


@lru_cache(maxsize=24)
def native_rgb(ra, dec, channels):
    jobs = {c: RGB_LOOKUPS.submit(native_component, ra, dec, c) for c in set(channels)}
    components = [jobs[c].result() for c in channels]
    if any(component is None for component in components):
        return None
    return compose_native_rgb(ra, dec, components)


GAIA_TAP = 'https://gea.esac.esa.int/tap-server/tap/sync'
GAIA_SOURCE_FIELDS = (
    'phot_bp_mean_mag', 'phot_rp_mean_mag', 'bp_rp', 'parallax', 'parallax_error',
    'radial_velocity', 'radial_velocity_error', 'teff_gspphot', 'distance_gspphot',
    'ruwe', 'classprob_dsc_combmod_star', 'classprob_dsc_combmod_galaxy',
    'classprob_dsc_combmod_quasar',
)


def gaia_number(value):
    if not value:
        return None
    parsed = float(value)
    return parsed if math.isfinite(parsed) else None


def gaia_query(query, timeout=18):
    response = requests.get(GAIA_TAP, params={
        'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': query
    }, timeout=timeout)
    response.raise_for_status()
    reader = csv.DictReader(response.text.splitlines())
    if not reader.fieldnames or 'source_id' not in reader.fieldnames:
        raise ValueError('Resposta Gaia inválida')
    return list(reader)


@lru_cache(maxsize=512)
def find_gaia_source(source_id):
    fields = ', '.join('g.' + field for field in GAIA_SOURCE_FIELDS)
    rows = gaia_query(f"""
        SELECT g.source_id, {fields}, g.phot_variable_flag,
               w.original_ext_source_id, w.angular_distance, w.number_of_mates
        FROM gaiadr3.gaia_source AS g
        LEFT OUTER JOIN gaiadr3.allwise_best_neighbour AS w ON w.source_id = g.source_id
        WHERE g.source_id = {source_id}
    """)
    if not rows:
        return None
    row = rows[0]
    result = {field: gaia_number(row[field]) for field in GAIA_SOURCE_FIELDS}
    result['variable'] = row['phot_variable_flag'] == 'VARIABLE'
    result['allwise'] = (dict(
        id=row['original_ext_source_id'], separation=gaia_number(row['angular_distance']),
        mates=gaia_number(row['number_of_mates'])
    ) if row['original_ext_source_id'] else None)
    wise = result['allwise']
    if wise and re.fullmatch(r'J[0-9.]+[+-][0-9.]+', wise['id']):
        try:
            photometry = gaia_query(
                "SELECT TOP 1 designation AS source_id, w1mpro, w2mpro "
                f"FROM gaiadr1.allwise_original_valid WHERE designation = '{wise['id']}'",
                timeout=6,
            )
            if photometry:
                wise['w1'] = gaia_number(photometry[0]['w1mpro'])
                wise['w2'] = gaia_number(photometry[0]['w2mpro'])
        except (ValueError, requests.RequestException):
            pass
    return result


@lru_cache(maxsize=48)
def find_gaia(ra, dec, radius):
    query = f"""SELECT TOP 500 source_id,ra,dec,phot_g_mean_mag,pmra,pmdec
        FROM gaiadr3.gaia_source
        WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',{ra},{dec},{radius}))
        ORDER BY phot_g_mean_mag"""
    return [dict(id='Gaia ' + row['source_id'], ra=float(row['ra']), dec=float(row['dec']),
                 mag=gaia_number(row['phot_g_mean_mag']), pmra=gaia_number(row['pmra']),
                 pmdec=gaia_number(row['pmdec'])) for row in gaia_query(query)]


class AtlasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT / 'dist', **kwargs)

    def send_data(self, content, mime, status=200):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        path = urlsplit(self.path).path
        if not (auth_post(self, path) or community_post(self, path)):
            self.send_error(404)

    def do_GET(self):
        url = urlsplit(self.path)
        if auth_get(self, url) or community_get(self, url):
            return
        if url.path.startswith(('/api/local-frame/', '/api/local-preview/', '/api/local-original/')):
            entry = LOCAL_EPOCHS.get(url.path.rsplit('/', 1)[-1])
            if not entry:
                self.send_error(404)
                return
            try:
                mime = 'application/fits'
                if url.path.startswith('/api/local-original/'):
                    if entry.path.suffix == '.gz':
                        with gzip.open(entry.path, 'rb') as original:
                            content = original.read()
                    else:
                        content = entry.path.read_bytes()
                else:
                    with fits.open(entry.path) as hdus:
                        image = hdus['IMAGE']
                        if url.path.startswith('/api/local-preview/'):
                            output = BytesIO()
                            Image.fromarray(display_pixels(image)[::-1]).save(output, 'PNG')
                            content = output.getvalue()
                            mime = 'image/png'
                        else:
                            content = render_exposure(image)
                self.send_data(content, mime)
            except (OSError, ValueError, KeyError) as error:
                self.log_error('%s', error)
                self.send_error(404, 'Exposição local indisponível')
            return
        if url.path.startswith('/api/frame/'):
            data = FRAMES.get(url.path.rsplit('/', 1)[-1])
            if data is None:
                self.send_error(404)
            else:
                self.send_data(data, 'application/fits')
            return
        if url.path == '/api/temporal-tiles':
            try:
                query = parse_qs(url.query)
                ra, dec, extent = (float(query[key][0]) for key in ('ra','dec','size'))
                channel = int(query['channel'][0])
                if not (0 <= ra < 360 and -90 <= dec <= 90 and .08 <= extent <= 20
                        and 1 <= channel <= 102 and channel not in (51,52)):
                    raise ValueError()
            except (ValueError, KeyError):
                self.send_error(400)
                return
            try:
                result = tiled_history(ra,dec,extent,channel)
                self.send_data(json.dumps(result,allow_nan=False).encode(),'application/json')
            except Exception as error:
                self.log_error('%s',error)
                self.send_error(502,'Exposições temporais indisponíveis')
            return
        if url.path == '/api/scans':
            from live_scan import saved_scans
            self.send_data(json.dumps(saved_scans(), allow_nan=False).encode(), 'application/json')
            return
        if url.path == '/api/source-spectrum':
            try:
                query = parse_qs(url.query)
                ra, dec = (round(float(query[key][0]), 5) for key in ('ra', 'dec'))
                if not (0 <= ra < 360 and -90 <= dec <= 90):
                    raise ValueError()
            except (KeyError, ValueError, OverflowError):
                self.send_error(400)
                return
            try:
                from source_spectrum import spectrum
                values = spectrum(ra, dec)
                self.send_data(json.dumps({'radiance': values}, allow_nan=False).encode(),
                               'application/json')
            except (OSError, ValueError, requests.RequestException) as error:
                self.log_error('%s', error)
                self.send_error(502, 'Mosaico SPHEREx indisponível')
            return
        if url.path == '/api/gaia-source':
            value = parse_qs(url.query).get('source_id', [''])[0]
            if not value.isascii() or not value.isdecimal() or len(value) > 19:
                self.send_error(400)
                return
            try:
                source = find_gaia_source(int(value))
                if source is None:
                    self.send_error(404)
                else:
                    self.send_data(json.dumps(source, allow_nan=False).encode(), 'application/json')
            except (KeyError, ValueError, requests.RequestException) as error:
                self.log_error('%s', error)
                self.send_error(502, 'Catálogo Gaia indisponível')
            return
        if url.path not in ('/api/exposures', '/api/gaia', '/api/scan', '/api/rgb-detail', '/api/native-detail'):
            return super().do_GET()
        try:
            params = parse_qs(url.query)
            ra, dec, size = (round(float(params[key][0]), 5) for key in ('ra', 'dec', 'size'))
            if not (0 <= ra <= 360 and -90 <= dec <= 90 and .02 <= size <= 1):
                raise ValueError('Área inválida')
            if url.path == '/api/rgb-detail':
                rgb = tuple(map(int,params['rgb'][0].split(',')))
                if len(rgb) != 3 or any(not 1 <= c <= 102 or c in (51,52) for c in rgb):
                    raise ValueError('Faixas inválidas')
            if url.path in ('/api/exposures', '/api/native-detail'):
                channel = int(params['channel'][0])
                if not 1 <= channel <= 102:
                    raise ValueError('Canal inválido')
            else:
                channel = None
        except (KeyError, ValueError, OverflowError):
            self.send_error(400)
            return
        try:
            if url.path == '/api/scan':
                from live_scan import scan
                result = scan(ra, dec)
            elif url.path == '/api/rgb-detail':
                result = native_rgb(ra, dec, rgb)
            elif url.path == '/api/native-detail':
                native = native_preview(ra, dec, channel)
                result = dict(store_frame(*native), requestedChannel=channel) if native else None
            elif channel is None:
                result = find_gaia(ra, dec, round(size * .72, 5))
            elif channel in (51, 52):
                result = dict(dates={}, failures=0)
            elif params.get('aligned') == ['1']:
                larger = {day: {channel: frames[channel]} for day, frames in expanded_dates(ra, dec).items()
                          if channel in frames}
                if larger and size <= .12:
                    result = dict(dates=larger, failures=0, cached=True)
                else:
                    result = aligned_history(ra, dec, size, channel)
            else:
                detector = (channel - 1) // 17 + 1
                larger = expanded_dates(ra, dec)
                local_dates = {day:dict(frames) for day,frames in
                               archived_dates(ra, dec, tuple(LOCAL_EPOCHS.candidates(ra, dec))).items()}
                for day, frames in larger.items():
                    local_dates.setdefault(day, {}).update(frames)
                if local_dates:
                    result = dict(dates=local_dates, failures=0, source='local')
                else:
                    result = find_exposures(ra, dec, size, detector)
            self.send_data(json.dumps(result, allow_nan=False).encode(), 'application/json')
        except Exception as error:
            self.log_error('%s', error)
            self.send_error(502, 'Arquivo de dados indisponivel')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(('127.0.0.1', args.port), AtlasHandler) as server:
        server.serve_forever()
