"""Build dated, masked SPHEREx tiles on a shared celestial grid."""
from base64 import b64encode
from concurrent.futures import as_completed
from hashlib import sha256
import json
import logging
import math
from pathlib import Path
from tempfile import TemporaryDirectory
import time
from uuid import uuid4

import aiohttp
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
import numpy as np
from scipy.ndimage import map_coordinates

TILE = 128


def project_exposure(source, view, side, nominal):
    view = view.deepcopy()
    with fits.open(source, use_fsspec=True, fsspec_kwargs={
        'block_size': 512 * 1024, 'client_kwargs': {'timeout': aiohttp.ClientTimeout(total=12)}
    }) as hdus:
        image = hdus['IMAGE']
        spatial = WCS(image.header).celestial
        h, w = image.shape
        edge = np.linspace(0, 1, 9)
        corners = spatial.pixel_to_world(
            np.r_[edge*w, edge*w, edge*0, edge*0+w-1].clip(0,w-1),
            np.r_[edge*0, edge*0+h-1, edge*h, edge*h].clip(0,h-1))
        px, py = view.world_to_pixel(corners)
        if not np.isfinite(px).all() or not np.isfinite(py).all():
            return
        x0, x1 = max(0, math.floor(px.min())-2), min(side, math.ceil(px.max())+3)
        y0, y1 = max(0, math.floor(py.min())-2), min(side, math.ceil(py.max())+3)
        if x0 >= x1 or y0 >= y1:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1]
        sx, sy = spatial.world_to_pixel(view.pixel_to_world(xx, yy))
        covered = (sx>=0)&(sx<=w-1)&(sy>=0)&(sy<=h-1)
        if not covered.any():
            return
        spectral = WCS(image.header, fobj=hdus, key='W')
        spectral.sip = None
        wave, width = spectral.pixel_to_world(sx[covered], sy[covered])
        distance = np.abs(wave.to_value('um')-nominal)
        covered[covered] = distance <= width.to_value('um')/2
        if not covered.any():
            return
        ix, iy = sx[covered], sy[covered]
        left, bottom = math.floor(ix.min()), math.floor(iy.min())
        window = np.float32(image.section[bottom:min(h,math.ceil(iy.max())+1),
                                          left:min(w,math.ceil(ix.max())+1)])
        sampled = map_coordinates(window, [iy-bottom,ix-left], order=1, cval=np.nan)
        good = np.isfinite(sampled)
        return yy[covered][good], xx[covered][good], sampled[good]


def build_tiles(root, ra, dec, extent, channel, nominal, exposures, pool, mirror):
    key = sha256(repr((2,ra,dec,extent,channel,int(time.time()/86400))).encode()).hexdigest()[:24]
    dest = root / key
    manifest = dest / 'index.json'
    if manifest.exists():
        existing = json.loads(manifest.read_text())
        if not existing.get('partial') or time.time()-manifest.stat().st_mtime<180:
            return dict(existing, cached=True)
    root.mkdir(parents=True, exist_ok=True)
    # TAN is stable for these local fields. Preserve native sampling at close zoom.
    span = math.degrees(2*math.tan(math.radians(extent/2)))
    scale = max(6.2/3600, span/(4*TILE))
    side = max(TILE, math.ceil(span/scale/TILE)*TILE)
    view = WCS(naxis=2)
    view.wcs.ctype = ['RA---TAN','DEC--TAN']
    view.wcs.crval = [ra,dec]
    view.wcs.crpix = [(side+1)/2]*2
    view.wcs.cdelt = [-scale,scale]
    view.wcs.radesys = 'ICRS'
    entries, partial = exposures()
    jobs = {pool.submit(project_exposure, mirror(url), view, side, nominal): (stamp,url)
            for stamp,url in entries}
    days = {}
    failures = 0
    for future in as_completed(jobs):
        stamp, url = jobs[future]
        try:
            sample = future.result()
        except (OSError, ValueError, KeyError, RuntimeError, aiohttp.ClientError) as error:
            failures += 1
            logging.warning('Bloco SPHEREx %s: %s', url, error)
            continue
        if sample is None or not sample[2].size:
            continue
        utc = Time(stamp,format='mjd').iso
        day = utc[:10]
        if day not in days:
            days[day] = (np.zeros((side,side),np.float32),np.zeros((side,side),np.uint16),utc,url)
        values, count, _, _ = days[day]
        y,x,pixels = sample
        values[y,x] += pixels
        count[y,x] += 1
    if failures and not days:
        raise OSError('Nenhuma exposição temporal pôde ser lida')
    good_pixels = [values[count>0]/count[count>0] for values,count,_,_ in days.values()]
    lo, hi = np.percentile(np.concatenate(good_pixels),[30,99.8]) if good_pixels else (0,1)
    positions = [(x,y) for y in range(0,side,TILE) for x in range(0,side,TILE)]
    positions.sort(key=lambda corner: sum((value+TILE/2-side/2)**2 for value in corner))
    header = fits.PrimaryHDU(np.empty((side,side),np.float32),view.to_header()).header
    encoded_header = b64encode(header.tostring().encode('ascii')).decode('ascii')
    result = dict(dates={}, failures=failures, scale=scale*3600, cached=False, partial=partial or bool(failures))
    with TemporaryDirectory(dir=root) as temp:
        generation = key+uuid4().hex[:8]
        output = Path(temp) / generation
        output.mkdir()
        for day,(values,count,utc,url) in sorted(days.items()):
            tiles = []
            for x,y in positions:
                window = np.s_[y:y+TILE,x:x+TILE]
                n = count[window]
                if not n.any():
                    continue
                raw = np.divide(values[window], n, out=np.full(n.shape,np.nan,np.float32), where=n>0)
                clipped = np.clip((raw-lo)/max(hi-lo,1.e-10),0,1)
                pixels = np.float32(255*np.arcsinh(clipped*12)/np.arcsinh(12))
                filename = f'{day}-{x}-{y}.fits'
                fits.writeto(output/filename,pixels,view.slice(window).to_header())
                tiles.append(f'/temporal-tiles/{generation}/{filename}')
            result['dates'][day] = {channel: dict(tiles=tiles,grid=dict(tiles=tiles,side=side,header=encoded_header),utc=utc,url=url,
                                                  wave=nominal,pixelScale=scale*3600)}
        output.rename(root/generation)
        dest.mkdir(exist_ok=True)
        staged_manifest = Path(temp)/'index.json'
        staged_manifest.write_text(json.dumps(result))
        staged_manifest.replace(manifest)
    return result
