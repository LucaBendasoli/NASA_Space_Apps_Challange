from acquire import regions
from pathlib import Path
import requests,time,concurrent.futures,json
p=Path('/tmp/atlas-mvp-run/campo-c03')
url='https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/hips5_cube/hips_20261026/Norder5/Dir0/Npix8455_cube.fits'
start=time.perf_counter()
ranges=[(0,8639)]+[(8640+i*1048576,8640+min(i+4,102)*1048576-1) for i in range(0,102,4)]
def chunk(bounds):
 a,b=bounds
 for _ in range(3):
  try:
   r=requests.get(url,headers={'Range':f'bytes={a}-{b}'},timeout=19)
   if r.status_code==206 and r.headers.get('Content-Range','').startswith(f'bytes {a}-{b}/') and len(r.content)==b-a+1:return r.content
  except requests.RequestException:pass
 raise RuntimeError(bounds)
with concurrent.futures.ThreadPoolExecutor(8) as e:data=b''.join(e.map(chunk,ranges))
(p/'cube.bin').write_bytes(data)
print('C03 cube',len(data),time.perf_counter()-start)
