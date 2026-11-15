from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from io import BytesIO
from astropy_healpix import HEALPix
import astropy.units as u
import numpy as np
from PIL import Image
import requests
BASE='https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube'
def tile(i):
 r=requests.get(f'{BASE}/Norder0/Dir0/Npix{i}_63.png',timeout=15)
 r.raise_for_status()
 return np.asarray(Image.open(BytesIO(r.content)).convert('L'))
with ThreadPoolExecutor(6) as e: tiles=np.stack(list(e.map(tile,range(12))))
height,width=768,1536
lon,lat=np.meshgrid((np.arange(width)+.5)*360/width,90-(np.arange(height)+.5)*180/height)
p=HEALPix(nside=512,order='nested').lonlat_to_healpix(lon*u.deg,lat*u.deg)
base=p//512**2
x=np.zeros_like(p);y=x.copy()
for i in range(9):
 x|=((p>>(2*i))&1)<<i
 y|=((p>>(2*i+1))&1)<<i
# HiPS raster rows correspond to the first nested coordinate.
sky=tiles[base,x,y]
Image.fromarray(sky).save(Path(__file__).parent/'dist'/'sky.webp',quality=87)
