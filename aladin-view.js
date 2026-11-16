import A from './vendor/aladin.js';

async function connectSpectralTiles() {
 await navigator.serviceWorker.register('./spectral-tiles.js');
 const registration = await navigator.serviceWorker.ready;
 if (navigator.serviceWorker.controller) return;
 await new Promise(resolve => {
  navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true});
  registration.active?.postMessage('claim');
 });
}

function spectralSurvey(channel) {
 return new URL('spectral-map/' + channel, location.href).href;
}
const SURVEYS={
 sdss:{label:t('Luz visível · SDSS DR9'),scale:'0,40',url:'https://irsa.ipac.caltech.edu/data/hips/CDS/SDSS/DR9/color'},
 dss:{label:t('Luz visível · DSS'),scale:'0,80',url:'https://casda.csiro.au/hips/DSS2/color'},
 wise:{label:t('Infravermelho · AllWISE'),scale:'1,61',url:'https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1'}
};
const fieldOfView = 0.18;
const hitRadius = 16;

export async function createAladin(host, center, channel, onSelect, onError, onCoverage, target=center, localFirst=false) {
 const spectralTiles = connectSpectralTiles();
 const tileReady = localFirst
  ? Promise.race([spectralTiles.catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1000))])
  : spectralTiles;
 await Promise.all([A.init,tileReady]);
 const view = A.aladin(host, {
  target: target.join(' '), fov: fieldOfView, cooFrame: 'ICRS',
  survey: spectralSurvey(channel === 51 || channel === 52 ? 63 : channel), hipsList: [], log: false, backgroundColor: '#080a10',
  inertia: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  showLayersControl: false, showFullscreenControl: false, showReticle: false,
  showProjectionControl: false, showCooLocation: false,
  showShareControl: false, showSimbadPointerControl: false, showFrame: false
 });
 performance.setResourceTimingBufferSize(6000);
 view.setProjection('AIT');
 view.gotoRaDec(...target);

 let points = [], selectedId;
 let previousGaia=[], previousCandidates=[];
 let gaiaOpacity=1, candidateOpacity=1;
 function drawSource(source, ctx) {
   const selected = source.data.id === selectedId;
   const {x, y} = source;
   ctx.beginPath();
   const gaia = source.data.gaia;
   const radius = source.data.featured ? 8 : gaia ? (selected ? 8 : 3) : (selected ? 9 : 6);
   ctx.arc(x, y, radius, 0, 2 * Math.PI);
   ctx.lineWidth = gaia && !selected ? 1 : 2;
   ctx.strokeStyle = source.data.featured ? '#ffe4a3' : gaia
    ? (selected ? '#ffe4a3' : '#acd9fa')
    : (selected ? '#ff9ca3' : '#ff525e');
   ctx.save();
   ctx.globalAlpha=selected||source.data.featured?1:gaia?gaiaOpacity:candidateOpacity;
   ctx.stroke();
   ctx.restore();
 }
 const gaiaCatalog=A.catalog({name:'Gaia DR3', readOnly:true, shape:drawSource});
 const candidateCatalog=A.catalog({name:t('Candidatos da triagem'), readOnly:true, shape:drawSource});
 view.addCatalog(gaiaCatalog);
 view.addCatalog(candidateCatalog);
 const scanOverlay=A.graphicOverlay({name:t('Recorte da triagem'),color:'#ff9ca3',lineWidth:1,lineDash:[5,5]});
 view.addOverlay(scanOverlay);
 let footprintKey;


 view.on('click', ({x, y, isDragging}) => {
  if (isDragging) return;
  let closest, distance = hitRadius;
  for (const point of points) {
   const projected = view.world2pix(point.ra, point.dec);
   if (!projected) continue;
   const delta = Math.hypot(projected[0] - x, projected[1] - y);
   if (delta < distance) { closest = point; distance = delta; }
  }
  onSelect(closest?.id);
 });

 const dateLocator=A.graphicOverlay({name:t('Local da exposição'),color:'#ff9ca3',lineWidth:1.5});
 view.addOverlay(dateLocator);
 let current, layerNumber=0, exposureLayer, pendingExposure, exposureFootprint;
 let rgbDetail, pendingDetail;
 let comparison, opticalCoverage, opticalFootprint;
 let comparisonVisibility=new Map();
 let appearance={contrast:0,inverted:false,enhance:false};
 function applyAppearance(layer){
  if(!layer||!layer.added)return;
  layer.setOptions({contrast:appearance.contrast,gamma:appearance.enhance?.65:1});
 }
 function loadOpticalCoverage(){
  if(!opticalCoverage)opticalCoverage=new Promise(resolve=>{
   const timer=setTimeout(()=>resolve(null),4500);
   const moc=A.MOCFromURL(SURVEYS.sdss.url+'/Moc.fits',{opacity:0},value=>{
    clearTimeout(timer);
    value.hide();
    opticalFootprint=value;
    resolve(value);
    host.dispatchEvent(new Event('atlas-optical-coverage',{bubbles:true}));
   },()=>{
    clearTimeout(timer);
    resolve(null);
   });
   view.addMOC(moc);
  });
  return opticalCoverage;
 }
 let pendingBand, activeSurvey=spectralSurvey(channel===51||channel===52?63:channel);
 function waitForBand(survey,next,signal,preserve=false){
  const previous=view.getBaseImageLayer();
  const name='band-'+ ++layerNumber;
  const ready=new Promise(resolve=>{
   let pollTimer;
   let staged=false;
   let stableFrames=0;
   let lastSamples;
   const layer=view.createImageSurvey(survey);
   layer.setOpacity(0);
   function finish(success){
    clearTimeout(timeout);
    clearTimeout(pollTimer);
    signal?.removeEventListener('abort',cancel);
    if(pendingBand?.cancel===cancel)pendingBand=undefined;
    if(!success){
     if(layer.added)view.removeImageLayer(name);
     resolve(false);
     return;
    }
    if(preserve){
     if(previous)view.view.swapLayers(previous.layer,name);
     resolve(layer);
     return;
    }
    if(previous)view.removeImageLayer(previous.layer);
    channel=next;
    activeSurvey=survey;
    resolve(true);
   }
   function cancel(){finish(false)}
   const timeout=setTimeout(cancel,12000);
   pendingBand={survey,cancel};
   signal?.addEventListener('abort',cancel,{once:true});
   // Keep the live layer visible until the new layer can answer pixel probes.
   layer.successCallback=()=>{
    if(pendingBand?.cancel!==cancel)requestAnimationFrame(()=>view.removeImageLayer(name));
   };
   layer.errorCallback=cancel;
   view.setOverlayImageLayer(layer,name);
   function check(){
    if(layer.added){
     if(!staged){
      applyAppearance(layer);
      if(previous)view.view.swapLayers(previous.layer,name);
      layer.setOpacity(1);
      staged=true;
     }
     const samples=[];
     const positions=preserve?[.5]:[.15,.5,.85];
     for(const y of positions){
      for(const x of positions){
       const px=host.clientWidth*x,py=host.clientHeight*y;
       if(!view.pix2world(px,py))continue;
       try{samples.push(layer.readPixel(px,py))}catch{samples.push(null)}
      }
     }
     const complete=samples.length>0&&samples.every(value=>value!=null&&
      (typeof value==='number'?Number.isFinite(value):typeof value==='object'&&Object.values(value).some(Number.isFinite)&&(!preserve||value[3]!==0)));
     const signature=JSON.stringify(samples);
     stableFrames=complete?(signature===lastSamples?stableFrames+1:1):0;
     lastSamples=signature;
     if(stableFrames>=3){finish(true);return}
    }
    pollTimer=setTimeout(check,80);
   }
   pollTimer=setTimeout(check,80);
  });
  if(pendingBand?.survey===survey)pendingBand.ready=ready;
  return ready;
 }
 function syncCoverage() {
  const [ra, dec] = view.getRaDec();
  const [width,height] = view.getFoV();
  const east = ((ra - center[0] + 540) % 360 - 180) * Math.cos(center[1] * Math.PI / 180);
  const nearPrepared=Math.abs(east)<0.05&&Math.abs(dec-center[1])<0.05;
  onCoverage({ra,dec,fov:width,size:Math.max(width,height),nearPrepared,prepared:width<=0.75&&nearPrepared});
 }
 view.on('positionChanged', () => {syncCoverage();});
 function syncZoom() {
  const width=view.getFoV()[0];
  for(const name of exposureLayer??[])view.getOverlayImageLayer(name)?.setOpacity(comparison?0:1);
  dateLocator.removeAll();
  if(exposureFootprint&&!comparison&&width>0.75){
   const {ra,dec,fov}=exposureFootprint;
   dateLocator.add(A.circle(ra,dec,Math.max(fov/2,width*.015)));
  }
  dateLocator.reportChange();
 }
 view.on('zoomChanged', () => { syncZoom();syncCoverage(); });
 view.on('resizeChanged', () => { syncCoverage(); });
 syncCoverage();
 function visibleTiles() {
  const order=Math.min(5,view.view.realNorder);
  if(order<3)return ['Norder3/Allsky.png'];
  return view.view.getVisibleCells(order).map(cell=>{
   const pixel=Number(cell.ipix);
   return 'Norder'+order+'/Dir'+Math.floor(pixel/10000)*10000+'/Npix'+pixel+'.png';
  });
 }

 return {
  scanFootprint(center) {
   const key=center?.join(',');
   if(key===footprintKey)return;
   footprintKey=key;
   scanOverlay.removeAll();
   if(center){
    const [ra,dec]=center;
    const radians=Math.PI/180;
    const lat=dec*radians;
    const corners=[[-.05,-.05],[.05,-.05],[.05,.05],[-.05,.05]].map(([east,north])=>{
     const x=east*radians,y=north*radians;
     const denominator=Math.cos(lat)-y*Math.sin(lat);
     return [(ra+Math.atan2(x,denominator)/radians+360)%360,
      Math.atan2(Math.sin(lat)+y*Math.cos(lat),Math.hypot(denominator,x))/radians];
    });
    scanOverlay.add(A.polygon(corners));
   }
   scanOverlay.reportChange();
  },
  tilesFor(channels) {
   const tiles=visibleTiles();
   return channels.flatMap(band=>tiles.map(tile=>spectralSurvey(band)+'/'+tile));
  },
  warmNeighbors(next) {
   const tiles=visibleTiles().slice(0,8);
   for(const band of [next-1,next+1]){
    if(band<1||band>102||band===51||band===52)continue;
    for(const tile of tiles)fetch(spectralSurvey(band)+'/'+tile,{priority:'low'}).catch(()=>{});
   }
  },
  setFieldOfView(degrees) { view.setFoV(degrees); },
  focus(ra,dec) {
   view.gotoRaDec(ra,dec);
   if(view.getFoV()[0]>fieldOfView)view.setFoV(fieldOfView);
  },
  appearance(settings){
   appearance=settings;
   view.view.wasm.canvas().classList.toggle('sky-inverted',settings.inverted);
   for(const layer of view.getStackLayers())applyAppearance(view.getOverlayImageLayer(layer));
  },
  async opticalSurvey(){
   const coverage=opticalFootprint??await loadOpticalCoverage();
   return coverage?.contains(...view.getRaDec())?'sdss':'dss';
  },
  async showComparison(key,signal){
   if(signal.aborted)return false;
   if(comparison?.key===key)return SURVEYS[key];
   pendingBand?.cancel();
   pendingExposure?.cancel();
   pendingDetail?.cancel();
   const survey=SURVEYS[key];
   const layer=await waitForBand(survey.url,channel,signal,true);
   if(!layer)return false;
   if(signal.aborted){view.removeImageLayer(layer.layer);return false}
   if(comparison)view.removeImageLayer(comparison.layer);
   comparison={key,layer:layer.layer};
   syncZoom();
   for(const name of view.getStackLayers()){
    const item=view.getOverlayImageLayer(name);
    if(name===layer.layer||!item||comparisonVisibility.has(name))continue;
    comparisonVisibility.set(name,item.getOpacity());
    item.setOpacity(0);
   }
   return survey;
  },
  clearComparison(){
   if(!comparison)return;
   view.removeImageLayer(comparison.layer);
   comparison=undefined;
   for(const [name,opacity] of comparisonVisibility)view.getOverlayImageLayer(name)?.setOpacity(opacity);
   comparisonVisibility.clear();
   syncZoom();
  },
  clearRGBDetail(){
   pendingDetail?.cancel();
   if(rgbDetail)view.removeImageLayer(rgbDetail);
   rgbDetail=undefined;
  },
  showRGBDetail(frame,signal){
   if(signal.aborted)return Promise.resolve(false);
   pendingDetail?.cancel();
   const name='rgb-detail-'+ ++layerNumber;
   return new Promise(resolve=>{
    const request={cancel:()=>finish(false)};
    pendingDetail=request;
    const timer=setTimeout(request.cancel,8000);
    function finish(success){
     clearTimeout(timer);
     signal.removeEventListener('abort',request.cancel);
     if(pendingDetail===request)pendingDetail=undefined;
     if(!success)view.removeImageLayer(name);
     resolve(success);
    }
    signal.addEventListener('abort',request.cancel,{once:true});
    view.displayFITS(frame.image,{name:'SPHEREx RGB',imgFormat:'png',wcs:frame.wcs,opacity:0},()=>{
     requestAnimationFrame(()=>{
      const layer=view.getOverlayImageLayer(name);
      if(pendingDetail!==request || !layer){view.removeImageLayer(name);return}
      applyAppearance(layer);
      layer.setOpacity(1);
      if(rgbDetail)view.removeImageLayer(rgbDetail);
      rgbDetail=name;
      finish(true);
     });
    },request.cancel,name);
   });
  },
  async showRGB(channels) {
   const survey=new URL('spectral-rgb/'+channels.join('-'),location.href).href;
   if(pendingBand?.survey===survey)return pendingBand.ready;
   pendingBand?.cancel();
   pendingExposure?.cancel();
   if(activeSurvey===survey)return true;
   if(!await waitForBand(survey,channel))return false;
   for(const name of exposureLayer??[])view.removeImageLayer(name);
   exposureLayer=exposureFootprint=undefined;
   current=undefined;
   syncZoom();
   return true;
  },
  zoomToExposure(){
   if(exposureFootprint)view.setFoV(Math.min(view.getFoV()[0],Math.max(.04,exposureFootprint.fov)));
  },
  show(next,path,signal,notBefore=0) {
   if(signal?.aborted)return Promise.resolve(false);
   if(pendingExposure&&pendingExposure.path===path&&pendingExposure.channel===next)return pendingExposure.ready;
   const survey=spectralSurvey(next);
   if(pendingBand?.survey===survey&&!path)return pendingBand.ready;
   pendingExposure?.cancel();
   pendingBand?.cancel();
   const changeBand=()=>{
    if(next===channel&&activeSurvey===survey)return;
    channel=next;
    if(next===51||next===52)view.getBaseImageLayer()?.setOpacity(0);
    else{
     activeSurvey=survey;
     const layer=view.setBaseImageLayer(survey);
     layer.successCallback=()=>applyAppearance(layer);
    }
   };
   if(path===current || !path){
    if(!path&&exposureLayer){
     for(const name of exposureLayer)view.removeImageLayer(name);
     exposureLayer=exposureFootprint=undefined;
     current=undefined;
     syncZoom();
    }
    if(!path&&(next!==channel||activeSurvey!==survey)&&next!==51&&next!==52)return waitForBand(survey,next,signal);
    changeBand();
    return Promise.resolve(true);
   }
   const tiled=typeof path==='object';
   const layer='exposure-'+ ++layerNumber;
   let resolve, objectURL;
   const ready=new Promise(done=>{resolve=done});
   const controller=new AbortController();
   const request={path,channel:next,ready,cancel:()=>finish(false)};
   pendingExposure=request;
   const timeout=setTimeout(()=>finish(false,true),45000);
   let swapTimer;
   function finish(success,failed=false){
    if(pendingExposure!==request)return;
    clearTimeout(timeout);
    clearTimeout(swapTimer);
    signal?.removeEventListener('abort',request.cancel);
    pendingExposure=undefined;
    controller.abort();
    if(objectURL)URL.revokeObjectURL(objectURL);
    if(!success)view.removeImageLayer(layer);
    if(failed)onError();
    resolve(success);
   }
   signal?.addEventListener('abort',request.cancel,{once:true});
   async function assemble(grid){
    const header=Uint8Array.from(atob(grid.header),c=>c.charCodeAt(0));
    const stride=grid.side*4;
    const length=stride*grid.side;
    const output=new Uint8Array(header.length+Math.ceil(length/2880)*2880);
    output.set(header);
    const pixels=new DataView(output.buffer,header.length,length);
    for(let offset=0;offset<length;offset+=4)pixels.setUint32(offset,0x7fc00000);
    for(let first=0;first<grid.tiles.length;first+=6){
     await Promise.all(grid.tiles.slice(first,first+6).map(async url=>{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw Error(response.status);
      const tile=new Uint8Array(await response.arrayBuffer());
      const coords=/-(\d+)-(\d+)\.fits$/.exec(url);
      const x=Number(coords[1]), y=Number(coords[2]);
      const width=128*4;
      for(let row=0;row<128;row++){
       const start=2880+row*width;
       output.set(tile.subarray(start,start+width),header.length+(y+row)*stride+x*4);
      }
     }));
    }
    return URL.createObjectURL(new Blob([output],{type:'application/fits'}));
   }
   async function prepare(){
    const url=tiled?await assemble(path):new URL(path.replace(/\.png$/,'.fits'),location.href).href;
    if(tiled)objectURL=url;
    if(pendingExposure!==request){if(tiled)URL.revokeObjectURL(url);return}
    const staged=view.createImageFITS(url,{name:'SPHEREx',imgFormat:'fits',minCut:18,maxCut:255},(ra,dec,fov)=>{
     function swap(){
      if(pendingExposure!==request){view.removeImageLayer(layer);return}
      const overlay=view.getOverlayImageLayer(layer);
      if(!overlay){requestAnimationFrame(swap);return}
      const previous=exposureLayer;
      exposureLayer=[layer];
      exposureFootprint=tiled?undefined:{ra,dec,fov};
      applyAppearance(overlay);
      current=path;
      changeBand();
      syncZoom();
      for(const name of previous??[]){
       view.getOverlayImageLayer(name)?.setOpacity(0);
       view.removeImageLayer(name);
      }
      finish(true);
     }
     if(pendingExposure!==request){requestAnimationFrame(swap);return}
     swapTimer=setTimeout(()=>requestAnimationFrame(swap),Math.max(0,notBefore-performance.now()));
    },()=>finish(false,true));
    // Aladin 3.8.2 treats a constructor opacity of zero as its default of one.
    staged.setOpacity(0);
    view.setOverlayImageLayer(staged,layer);
   }
   prepare().catch(()=>finish(false,true));
   return ready;
  },
  markerOpacity(gaia,candidates) {
   gaiaOpacity=gaia;
   candidateOpacity=candidates;
   gaiaCatalog.reportChange();
   candidateCatalog.reportChange();
  },
  points(gaia, candidates, id) {
   const selectionChanged=selectedId!==id;
   selectedId=id;
   const changed=(previous,next)=>previous.length!==next.length||
    next.some((point,i)=>point.id!==previous[i].id||point.ra!==previous[i].ra||point.dec!==previous[i].dec);
   const gaiaChanged=changed(previousGaia,gaia);
   const candidatesChanged=changed(previousCandidates,candidates);
   if(gaiaChanged||candidatesChanged){
    points=[...gaia.map(point=>({...point,gaia:true})),...candidates];
   }
   if(gaiaChanged){
    previousGaia=gaia;
    gaiaCatalog.clear();
    gaiaCatalog.addSources(gaia.map(point=>A.source(point.ra,point.dec,{...point,gaia:true})));
   }else if(selectionChanged)gaiaCatalog.reportChange();
   if(candidatesChanged){
    previousCandidates=candidates;
    candidateCatalog.clear();
    candidateCatalog.addSources(candidates.map(point=>A.source(point.ra,point.dec,point)));
   }else if(selectionChanged)candidateCatalog.reportChange();
  }
 };
}
