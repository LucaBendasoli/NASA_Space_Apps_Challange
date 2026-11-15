"""Align larger L2 cutouts on one celestial grid with a shared display stretch."""
import argparse
import json
from pathlib import Path

from astropy.io import fits
from astropy.wcs import WCS
from astropy.wcs.utils import proj_plane_pixel_scales
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates


def align(manifest, destination, ra, dec, channel, url_prefix):
    records = json.loads(manifest.read_text())
    inputs = []
    for record in records:
        with fits.open(manifest.parent / 'raw' / (record['day'] + '.fits')) as hdus:
            image = hdus['IMAGE']
            spectral = WCS(image.header, fobj=hdus, key='W')
            spectral.sip = None
            spatial = WCS(image.header).celestial
            x, y = spatial.world_to_pixel_values(ra, dec)
            wave, bandwidth = spectral.pixel_to_world(float(x), float(y))
            wave, bandwidth = wave.to_value('um'), bandwidth.to_value('um')
            requested = record['frame']['wave']
            if not np.isfinite(wave) or abs(wave - requested) > bandwidth / 2:
                raise ValueError(f"Faixa no centro incompatível em {record['day']}: {wave}")
            inputs.append((record, spatial, np.array(image.data, dtype=np.float32)))
    return align_images(inputs, destination, ra, dec, channel, url_prefix)


def align_images(inputs, destination, ra, dec, channel, url_prefix, extent=.22, minimum=63, **metadata):
    scale = max(float(np.max(proj_plane_pixel_scales(wcs))) for _, wcs, _ in inputs)
    half = max(1, int(extent / (2 * scale)))
    size = 2 * half + 1
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.crpix = [half + 1, half + 1]
    wcs.wcs.cdelt = [-scale, scale]
    wcs.wcs.radesys = 'ICRS'
    y, x = np.indices((size, size))
    lon, lat = wcs.pixel_to_world_values(x, y)
    covered = np.ones((size, size), dtype=bool)
    arrays = []
    for _, spatial, pixels in inputs:
        sx, sy = spatial.world_to_pixel_values(lon, lat)
        covered &= (sx>=0)&(sy>=0)&(sx<=pixels.shape[1]-1)&(sy<=pixels.shape[0]-1)
        arrays.append(map_coordinates(pixels, [sy,sx], order=1, cval=np.nan))
    outside = np.maximum(abs(x-half), abs(y-half))[~covered]
    radius = min(half, int(outside.min())-1) if outside.size else half
    if 2*radius+1 < minimum:
        raise ValueError(f'A cobertura comum contém apenas {2*radius+1} pixels por lado')
    bounds = slice(half-radius, half+radius+1)
    stack = np.stack([array[bounds,bounds] for array in arrays])
    wcs.wcs.crpix = [radius + 1, radius + 1]
    header = wcs.to_header()
    valid = np.isfinite(stack)
    if not valid.any():
        raise ValueError('Sem pixels válidos na grade comum')
    lo, hi = np.percentile(stack[valid], [30, 99.8])
    stretch = np.clip((stack-lo)/max(hi-lo,1e-10),0,1)
    gray = np.uint8(255*np.arcsinh(np.where(valid,stretch,0)*12)/np.arcsinh(12))
    destination.mkdir(parents=True,exist_ok=True)
    frames = {}
    for (record, _, _), pixels in zip(inputs, gray):
        day = record['day']
        fits.writeto(destination / (day+'.fits'), pixels, header, overwrite=True)
        Image.fromarray(pixels[::-1]).save(destination / (day+'.png'))
        frames[day] = dict(
            record['frame'], fits=f'{url_prefix}/{day}.fits', preview=f'{url_prefix}/{day}.png',
            url=record['archiveUrl'], pixelScale=round(scale*3600,2), expanded=True,
        )
    result = dict(ra=ra, dec=dec, channel=channel, width=int(gray.shape[1]),
                  scale=round(scale*3600,2), cuts=[float(lo),float(hi)], frames=frames, **metadata)
    (destination/'series.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(f'{len(frames)} quadros, {result["width"]}×{result["width"]}, {result["scale"]}″/pixel, cortes {result["cuts"]}')
    return result


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('manifest',type=Path)
    cli.add_argument('destination',type=Path)
    cli.add_argument('--ra',type=float,required=True)
    cli.add_argument('--dec',type=float,required=True)
    cli.add_argument('--channel',type=int,required=True)
    cli.add_argument('--url-prefix',required=True)
    args = cli.parse_args()
    align(args.manifest,args.destination,args.ra,args.dec,args.channel,args.url_prefix)
