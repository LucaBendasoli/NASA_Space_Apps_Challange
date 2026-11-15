"""Build a local sample of dated spectral exposures and the 100 DR1 mosaic channels."""
import csv
from io import BytesIO
import json
from pathlib import Path
import sys
from concurrent.futures import ThreadPoolExecutor

from astropy import log
from astropy.io import fits
from astropy.io.votable import parse
from astropy.time import Time
from astropy.wcs import WCS
import numpy as np
from PIL import Image
import requests
from scipy.ndimage import map_coordinates

from acquire import regions

log.setLevel('ERROR')
DIST=Path(__file__).resolve().parent/'dist'
waves=np.array(json.loads((DIST.parent/'channels.json').read_text()))
archives=Path(sys.argv[1])
prepared=Path(sys.argv[2])
def image(array,path,limits=None):
 values=array[np.isfinite(array)]
 lo,hi=np.percentile(values,[30,99.8]) if limits is None else limits
 scale=max(hi-lo,1e-10)
 img=np.arcsinh(np.clip((array-lo)/scale,0,1)*12)/np.arcsinh(12)
 img=np.where(np.isfinite(img),img,0)
 Image.fromarray(np.uint8(255*img[::-1])).save(path)

def prepare(region):
 name,ra,dec,_=region
 folder=DIST/'observacoes'/name
 folder.mkdir(parents=True,exist_ok=True)
 mosaics={}
 for row in csv.DictReader((prepared/name/'catalog/catalogo-imagens.csv').open()):
  if row['missao']!='SPHEREx':continue
  channel=int(row['canal'])
  filename=f'm{channel:03}.png'
  image(fits.getdata(prepared/name/'catalog'/row['fits']),folder/filename)
  mosaics[channel]=filename
 groups={}
 for path in sorted(archives.glob(f'{name}-*.vot')):
  if path.stat().st_size<1000:continue
  tab=parse(path).get_first_table().to_table(use_names_over_ids=True)
  for r in tab:
   day=Time(float(r['t_min']),format='mjd').iso[:10]
   detector=str(r['energy_bandpassname'])
   groups.setdefault((day[:7],detector),[]).append((float(r['t_min']),str(r['access_url']),str(r['obs_id'])))
 jobs=[]
 for group in groups.values():
  group=sorted(set(group))
  for j in sorted(set(np.linspace(0,len(group)-1,min(4,len(group))).astype(int))):
   jobs.append(group[j])
 w=WCS(naxis=2)
 w.wcs.ctype=['RA---TAN','DEC--TAN'];w.wcs.crval=[ra,dec];w.wcs.crpix=[61,61];w.wcs.cdelt=[3/3600,3/3600]
 yy,xx=np.indices((121,121))
 lon,lat=w.all_pix2world(xx,yy,0)
 def download(job):
  mjd,url,obs=job
  try:
   response=requests.get(url,params={'center':f'{ra},{dec}','size':'.112'},timeout=12)
   response.raise_for_status()
   with fits.open(BytesIO(response.content)) as h:
    a=h['IMAGE'];pos=WCS(a.header)
    x0,y0=pos.all_world2pix(ra,dec,0)
    if not (0<=x0<a.data.shape[1] and 0<=y0<a.data.shape[0]):return
    spectral=WCS(a.header,h,key='W');spectral.sip=None
    wl,bw=spectral.pixel_to_world(x0,y0)
    wl,bw=float(wl.value),float(bw.value)
    channel=int(np.argmin(abs(waves-wl)))+1
    if channel in (51,52) or abs(wl-waves[channel-1])>bw/2:return
    x,y=pos.all_world2pix(lon,lat,0)
    z=map_coordinates(a.data.astype(float),[y,x],order=1,cval=np.nan)
    if np.isfinite(z).mean()<.9:return
    return (mjd,channel,wl,bw,z,url,obs)
  except (requests.RequestException,ValueError,KeyError,IndexError,OSError) as e:
   print(name,obs,str(e)[:100],flush=True)
 with ThreadPoolExecutor(7) as pool:
  results=[r for r in pool.map(download,jobs) if r is not None]
 limits={}
 for channel in {r[1] for r in results}:
  pooled=np.concatenate([r[4][np.isfinite(r[4])] for r in results if r[1]==channel])
  limits[channel]=np.percentile(pooled,[30,99.8])
 dates={}
 for j,(mjd,c,wl,bw,a,url,obs) in enumerate(sorted(results,key=lambda r:r[0])):
  stamp=Time(mjd,format='mjd').iso
  day=stamp[:10]
  frames=dates.setdefault(day,{})
  if str(c) in frames and abs(frames[str(c)]['wave']-waves[c-1])<=abs(wl-waves[c-1]):continue
  filename=f'e{j:03}.png'
  image(a,folder/filename,limits[c])
  frames[str(c)]=dict(file=filename,wave=wl,width=bw,utc=stamp,url=url,obs=obs)
 (folder/'index.json').write_text(json.dumps(dict(mosaics=mosaics,dates=dates),separators=(',',':')))
 used={f['file'] for row in dates.values() for f in row.values()}|set(mosaics.values())
 for path in folder.glob('*.png'):
  if path.name not in used:path.unlink()
 print(name,len(jobs),len(dates),sum(map(len,dates.values())),flush=True)
selected=[r for r in regions if len(sys.argv)<4 or r[0] in sys.argv[3:]]
with ThreadPoolExecutor(3) as pool:list(pool.map(prepare,selected))
