from pathlib import Path
import csv,json,tarfile,time,sys,io,base64
import numpy as np
from scipy.ndimage import map_coordinates
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image
from acquire import regions

project=Path(__file__).resolve().parent
waves=json.loads((project/'channels.json').read_text())
algorithm=(project/'detector.py').read_text()
def process_field(name, ra, dec, cache, extra_cubes=(), include_image=True):
 start=time.perf_counter()
 root=cache/'catalog'
 root.mkdir(exist_ok=True)
 origin=[ra,dec]
 target=WCS(naxis=2)
 target.wcs.ctype=['RA---TAN','DEC--TAN']
 target.wcs.crval=origin
 target.wcs.crpix=[61,61]
 target.wcs.cdelt=[3/3600,3/3600]
 target.wcs.radesys='ICRS'
 y,x=np.indices((121,121))
 lon,lat=target.all_pix2world(x,y,0)
 hdr=target.to_header()
 meta=[]
 def add(id,mission,canal,wl,data,w):
  px,py=w.all_world2pix(lon,lat,0)
  a=map_coordinates(data.astype(float),[py,px],order=1,cval=np.nan)
  assert np.isfinite(a).mean()>.95,(name,id)
  path=id+'.fits'
  fits.writeto(root/path,a.astype('f4'),hdr,overwrite=True)
  meta.append(dict(missao=mission,id=id,canal=canal,lambda_um=wl,fits=path))
 keys=('CTYPE1','CTYPE2','CRPIX1','CRPIX2','CRVAL1','CRVAL2','CUNIT1','CUNIT2','PV2_1','PV2_2','LONPOLE','LATPOLE','RADESYS','CD1_1','CD1_2','CD2_1','CD2_2','PC1_1','PC1_2','PC2_1','PC2_2','CDELT1','CDELT2')
 cubes=[]
 for path in (cache/'cube.bin', *extra_cubes):
  with fits.open(path,ignore_missing_end=True) as h:
   header=h[1].header.copy()
   offset=h[1].fileinfo()['datLoc']
  w=WCS({k:header[k] for k in keys if k in header})
  px,py=w.all_world2pix(lon,lat,0)
  cube=np.memmap(path,dtype='>f4',mode='r',offset=offset,shape=(102,512,512))
  cubes.append((cube,px,py))
 for c,wl in enumerate(waves,1):
  if c in (51,52):continue
  a=np.full(lon.shape,np.nan)
  for cube,px,py in cubes:
   missing=~np.isfinite(a)
   if not missing.any():break
   a[missing]=map_coordinates(cube[c-1].astype(float),[py[missing],px[missing]],order=1,cval=np.nan)
  if np.isfinite(a).mean()<=.95:
   raise ValueError(f'Cobertura SPHEREx insuficiente no canal {c}')
  image_id=f'SPX{c:03}'
  path=image_id+'.fits'
  fits.writeto(root/path,a.astype('f4'),hdr,overwrite=True)
  meta.append(dict(missao='SPHEREx',id=image_id,canal=c,lambda_um=wl,fits=path))
 for file,version,channels in [('allwise.tar.gz','allwise',[1]),('wise.tar.gz','neo7',[1,2])]:
  with tarfile.open(cache/file) as tar:
   for c in channels:
    member=next(m for m in tar if m.isfile() and m.name.endswith(f'-w{c}-img-m.fits'))
    with fits.open(io.BytesIO(tar.extractfile(member).read())) as h:
     add(f'{version}-W{c}','WISE',f'W{c}',3.4 if c==1 else 4.6,h[0].data,WCS(h[0].header))
 with (root/'catalogo-imagens.csv').open('w') as f:
  wr=csv.DictWriter(f,fieldnames=list(meta[0]));wr.writeheader();wr.writerows(meta)
 with (cache/'gaia.csv').open() as f:
  reader=csv.DictReader(f); sources=list(reader)
 if not sources or reader.fieldnames is None or 'source_id' not in reader.fieldnames or len(sources)>=100000:
  raise ValueError('Catálogo Gaia incompleto para a triagem')
 # Retain the margin for correct matching even near the field edge.
 (root/'gaia-dr3.csv').write_bytes((cache/'gaia.csv').read_bytes())
 preparation=time.perf_counter()-start
 ns={'DATA_ROOT':root,'CENTER':origin}
 exec(algorithm,ns)
 detected=time.perf_counter()
 d=dict(rows=[],bands={r['canal']:r['lambda_um'] for r in meta[:100]},wavelengths=waves,radiance={},gaia=ns['gxy'].tolist())
 if include_image:
  images=ns['images']
  combined=(np.mean(images[:100],axis=0)+np.mean(images[100:],axis=0))/2
  buf=io.BytesIO()
  Image.fromarray(np.uint8(255*(1-combined[::-1]))).save(buf,format='PNG')
  d['image']=base64.b64encode(buf.getvalue()).decode()
 for i,(p,ds,j,l,score,method) in enumerate(ns['chosen'],1):
  rid=f'C{i:02}'
  sr,sd=target.pixel_to_world_values(*(p/3+60))
  if name=='campo-c03' and np.linalg.norm(p-[-9,102])<=4:rid='C03'
  elif name=='campo-c03' and rid=='C03':rid='C03b'
  dr=dict(id=rid,ra_icrs_deg=float(sr),dec_icrs_deg=float(sd),leste_arcsec=p[0],norte_arcsec=p[1],dist_gaia_arcsec=ds,triagem=method,canais_spherex=' '.join(str(meta[k]['canal']) for k in sorted(l) if k<100),mosaicos_wise=' '.join(meta[k]['id'] for k in sorted(l) if k>=100))
  d['rows'].append(dr)
  rad=np.hypot(x-(p[0]/3+60),y-(p[1]/3+60))*3
  vals=[None]*102
  for r in meta[:100]:
   a=fits.getdata(root/r['fits'])
   core=a[(rad<=9)&np.isfinite(a)];sky=a[(rad>=18)&(rad<=30)&np.isfinite(a)]
   if core.size>=10 and sky.size>=30:vals[r['canal']-1]=round(float(core.mean()-np.median(sky)),7)
  d['radiance'][rid]=vals
 d['center']=origin
 stats=dict(preparation=preparation,detection=detected-start-preparation,output=time.perf_counter()-detected,processing=time.perf_counter()-start,acquisition=json.loads((cache/'acquisition.json').read_text()),candidates=len(d['rows']))
 return d,stats


if __name__=='__main__':
 for name,ra,dec,tile in regions:
  cache=Path(sys.argv[1])/name
  data,stats=process_field(name,ra,dec,cache)
  (project/'dist'/f'{name}.json').write_text(json.dumps(data,allow_nan=False,separators=(',',':')))
  print(name,stats,flush=True)
  (cache/'processing.json').write_text(json.dumps(stats))
