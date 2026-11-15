from pathlib import Path
import csv
import numpy as np
from astropy.io import fits
from scipy.ndimage import gaussian_filter, maximum_filter, label, map_coordinates
from scipy.spatial import cKDTree
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
root=DATA_ROOT
meta=[r for r in csv.DictReader((root/'catalogo-imagens.csv').open()) if r['fits']]
assert len(meta)==103
ra0,dec0=CENTER
gaia=list(csv.DictReader((root/'gaia-dr3.csv').open()))
gxy=np.array([[((float(r['ra'])-ra0+540)%360-180)*3600*np.cos(np.deg2rad(dec0)),(float(r['dec'])-dec0)*3600] for r in gaia]).reshape(-1,2)
tree=cKDTree(gxy)
detections=[]
images=[]
for i,r in enumerate(meta):
 a=fits.getdata(root/r['fits']).astype(float)
 finite=np.isfinite(a)
 fill=np.where(finite,a,np.nanmedian(a))
 z=gaussian_filter(fill,0.75)-gaussian_filter(fill,4)
 med=np.median(z[5:-5,5:-5])
 mad=1.4826*np.median(np.abs(z[5:-5,5:-5]-med))
 score=(z-med)/max(mad,1e-20)
 peaks=(z==maximum_filter(z,size=5))&(score>=5)&finite
 peaks[:5]=peaks[-5:]=False
 peaks[:,:5]=peaks[:,-5:]=False
 for y,x in zip(*np.nonzero(peaks)):
  detections.append((i,(x-60)*3.,(y-60)*3.,score[y,x]))
 lo,hi=np.nanpercentile(a,[35,99.8])
 images.append(np.nan_to_num(np.clip(np.arcsinh(9*(a-lo)/max(hi-lo,1e-20))/np.arcsinh(9),0,1)))
# A Gaia source seeds a halo only where it sits on visible emission.
# Connected components are calculated per layer, before the display average.
halo_layers=[]
gx_pix=np.rint(gxy[:,0]/3+60).astype(int).clip(0,120)
gy_pix=np.rint(gxy[:,1]/3+60).astype(int).clip(0,120)
for image in images:
    smooth=gaussian_filter(image,.65)
    components,_=label(smooth>=.12, structure=np.ones((3,3)))
    strong=smooth[gy_pix,gx_pix]>=.42
    seeds=components[gy_pix,gx_pix]
    halo_layers.append((smooth,components,strong,seeds))

def halo_only(k, px, py):
    smooth,components,strong,seeds=halo_layers[k]
    component=components[py,px]
    if not component:
        return False
    neighbors=np.flatnonzero(strong & (seeds==component) &
                            (np.hypot(gx_pix-px,gy_pix-py)<=15))
    for j in neighbors:
        line=map_coordinates(smooth,[np.linspace(py,gy_pix[j],30),
                               np.linspace(px,gx_pix[j],30)],order=1)
        # A dip below 65% of the fainter peak separates the two peaks.
        if line.min() >= .65*min(line[0],line[-1]):
            return True
    return False

original_detections=len(detections)
detections=[(k,x,y,score) for k,x,y,score in detections
            if not halo_only(k,round(x/3+60),round(y/3+60))]
print('Picos excluídos por halo:',original_detections-len(detections))
d=np.array(detections).reshape(-1,4)
sxy=d[:,1:3]
sp=d[:,0]<100
near=cKDTree(sxy)
chosen=[]
# Anchor at the finer WISE W1 grid and require independent SPHEREx support.
for row in sorted(d[d[:,0]==101],key=lambda r:-r[3]):
 p=row[1:3]
 ds,j=tree.query(p)
 if ds<=5 or any(np.linalg.norm(p-q[0])<=9 for q in chosen):continue
 hits=d[near.query_ball_point(p,8)]
 layer={int(h[0]) for h in hits}
 if len([k for k in layer if k<100])<3:continue
 # Require W2 too, so the two W1 mosaics are not counted as independent bands.
 if 102 not in layer:continue
 chosen.append((p,ds,j,layer,row[3],'WISE + SPHEREx'))
# Assess the broader footprint of bright Gaia sources in the composite.
# A nearby candidate in this footprint needs confirmation in both instruments.
combined=(np.mean(images[:100],axis=0)+np.mean(images[100:],axis=0))/2
smooth=gaussian_filter(combined,.8)
footprint,_=label(smooth>=.085,structure=np.ones((3,3)))
bright=smooth[gy_pix,gx_pix]>=.40
bright_ids=footprint[gy_pix,gx_pix]
excluded_candidates=[]
def in_bright_footprint(p):
    ix,iy=np.rint(p/3+60).astype(int)
    comp=footprint[iy,ix]
    return bool(comp and np.any(bright & (bright_ids==comp) &
                     (np.linalg.norm(gxy-p,axis=1)<=45)))

# Search for persistent peaks seen only by SPHEREx too.
for row in sorted(d[sp],key=lambda r:-r[3]):
 p=row[1:3]
 ds,j=tree.query(p)
 if ds<=8 or any(np.linalg.norm(p-q[0])<=12 for q in chosen):continue
 hits=d[near.query_ball_point(p,8)]
 layer={int(h[0]) for h in hits}
 sw=[float(meta[k]['lambda_um']) for k in layer if k<100]
 if len(sw)<8 or max(sw)-min(sw)<.35:continue
 if in_bright_footprint(p):
  excluded_candidates.append(p.tolist())
  continue
 chosen.append((p,ds,j,layer,row[3],'SPHEREx'))
chosen.sort(key=lambda q:(-q[0][1],q[0][0]))
print('detections',len(d),'candidates',len(chosen))
print([(p.tolist(),round(ds,1),len(l),method) for p,ds,j,l,s,method in chosen])
print('Rejeitados no halo composto:',len(excluded_candidates))
