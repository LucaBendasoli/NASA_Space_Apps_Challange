import requests,time,json,concurrent.futures,sys
from pathlib import Path
from io import BytesIO
import tarfile
regions=[('campo-c03',83.63615,-59.464758,8455),('campo-hercules',253.125,37.168899656,2400),('campo-leao',146.25,15.713861048,1100)]
def acquire(region, cache_dir=None, cube_fetch=None):
 name,ra,dec,tile=region
 p=Path(cache_dir if cache_dir is not None else sys.argv[1])/name
 p.mkdir(parents=True,exist_ok=True)
 def fetch(key,url,params=None,headers=None):
  start=time.perf_counter()
  for attempt in range(3):
   try:
    r=requests.get(url,params=params,headers=headers,timeout=50);r.raise_for_status()
    if headers:
     assert r.status_code==206 and len(r.content)==106963968
    return key,r.content,time.perf_counter()-start,r.url
   except Exception:
    if attempt==2:raise
 def cube():
  if cube_fetch is not None:
   return cube_fetch(tile)
  return fetch('cube.bin',f'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/hips5_cube/hips_20261026/Norder5/Dir{tile//10000*10000}/Npix{tile}_cube.fits',headers={'Range':'bytes=0-106963967'})
 def wise():
  return fetch('wise.tar.gz','https://unwise.me/cutout_fits',dict(version='neo7',ra=ra,dec=dec,size=260,bands=12))
 def gaia():
  return fetch('gaia.csv','https://gea.esac.esa.int/tap-server/tap/sync',dict(REQUEST='doQuery',LANG='ADQL',FORMAT='csv',MAXREC=100000,QUERY=f"SELECT source_id,ra,dec,phot_g_mean_mag,pmra,pmdec FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',{ra},{dec},0.085))"))
 start=time.perf_counter()
 with concurrent.futures.ThreadPoolExecutor(3) as e:
  jobs=[e.submit(f) for f in (cube,wise,gaia,lambda: fetch('allwise.tar.gz','https://unwise.me/cutout_fits',dict(version='allwise',ra=ra,dec=dec,size=260,bands=1)))]
  stats={}
  for job in concurrent.futures.as_completed(jobs):
   key,b,elapsed,url=job.result()
   if isinstance(b,Path): (p/key).symlink_to(b)
   else: (p/key).write_bytes(b)
   stats[key]=dict(bytes=(b.stat().st_size if isinstance(b,Path) else len(b)),seconds=elapsed,url=url)
   print(name,key,stats[key]['bytes'],round(elapsed,2),flush=True)
 stats['wall']=time.perf_counter()-start
 (p/'acquisition.json').write_text(json.dumps(stats))
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(3) as e:list(e.map(acquire,regions))
