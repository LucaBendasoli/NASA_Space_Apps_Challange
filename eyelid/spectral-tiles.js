const archive = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube';

const CACHE = 'eyelid-spherex-dr1-20261026';
const inflight = new Map();

async function getTile(url, remote) {
 const cache = await caches.open(CACHE);
 const saved = await cache.match(url);
 if (saved) return saved;
 if (!inflight.has(url)) {
  const job = (async()=>{
   const response = await fetch(remote);
   if (response.ok) {
    try { await cache.put(url, response.clone()); }
    catch(error) { console.warn('Eyelid tile cache:', error); }
   }
   return response;
  })().finally(()=>inflight.delete(url));
  inflight.set(url, job);
 }
 return (await inflight.get(url)).clone();
}

function properties(title) {
 return new Response([
  'obs_title = '+title,
  'hips_frame = equatorial',
  'hips_order = 5',
  'hips_order_min = 0',
  'hips_tile_width = 512',
  'hips_tile_format = png',
  'dataproduct_type = image'
 ].join('\n'), {headers:{'Content-Type':'text/plain'}});
}

function spectralTile(root, channel, file) {
 return getTile(new URL(channel+'/'+file,root).href, archive+'/'+file.replace(/\.png$/, '_'+channel+'.png'));
}

const rgbInflight=new Map();
function rgbTile(root,key,channels,file) {
 if(!rgbInflight.has(key)){
  rgbInflight.set(key,composeTile(root,channels,file).catch(()=>new Response(null,{status:502}))
   .finally(()=>rgbInflight.delete(key)));
 }
 return rgbInflight.get(key).then(response=>response.clone());
}

async function composeTile(root,channels,file) {
 const responses=await Promise.all(channels.map(channel=>spectralTile(root,channel,file)));
 if(responses.some(response=>!response.ok))return new Response(null,{status:502});
 const images=await Promise.allSettled(responses.map(async response=>createImageBitmap(await response.blob())));
 try{
  if(images.some(image=>image.status!=='fulfilled'))return new Response(null,{status:502});
  const [red,green,blue]=images.map(image=>image.value);
  if([green,blue].some(image=>image.width!==red.width||image.height!==red.height)){
   return new Response(null,{status:502});
  }
  const canvas=new OffscreenCanvas(red.width,red.height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const output=ctx.createImageData(red.width,red.height);
  for(const [component,image] of [red,green,blue].entries()){
   ctx.clearRect(0,0,red.width,red.height);
   ctx.drawImage(image,0,0);
   const input=ctx.getImageData(0,0,red.width,red.height).data;
   for(let pixel=0;pixel<input.length;pixel+=4){
    const alpha=input[pixel+3];
    output.data[pixel+component]=input[pixel]*alpha/255;
    output.data[pixel+3]=Math.max(output.data[pixel+3],alpha?255:0);
   }
  }
  ctx.putImageData(output,0,0);
  return new Response(await canvas.convertToBlob({type:'image/png'}),{headers:{'Content-Type':'image/png'}});
 }finally{
  for(const image of images)if(image.status==='fulfilled')image.value.close();
 }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 const root = new URL('spectral-map/', self.registration.scope);
 if (url.origin !== root.origin) return;
 if (/^\/(?:api\/(?:frame|local-frame|local-preview)\/[a-f0-9]+|observacoes\/[\w-]+\/e\d+\.fits|temporal-tiles\/[a-f0-9]+\/[0-9-]+\.fits|expanded-epochs\/[\w-]+\/[0-9-]+\.(?:fits|png))$/.test(url.pathname)) {
  event.respondWith(getTile(url.href, url.href));
  return;
 }
 const rgbRoot=new URL('spectral-rgb/',self.registration.scope);
 const tilePattern='(properties|Norder[0-5]/(?:Dir[0-9]+/Npix[0-9]+|Allsky)\\.png)';
 if(url.pathname.startsWith(rgbRoot.pathname)){
  const match=new RegExp('^([0-9]{1,3})-([0-9]{1,3})-([0-9]{1,3})/'+tilePattern+'$')
   .exec(url.pathname.slice(rgbRoot.pathname.length));
  if(!match)return;
  const channels=match.slice(1,4).map(Number), file=match[4];
  if(channels.some(c=>c<1||c>102||c===51||c===52))return;
  event.respondWith(file==='properties'?properties('SPHEREx DR1 · falsa cor'):
   rgbTile(root,url.href,channels,file));
  return;
 }
 if(!url.pathname.startsWith(root.pathname))return;
 const match=new RegExp('^([0-9]{1,3})/'+tilePattern+'$').exec(url.pathname.slice(root.pathname.length));
 if(!match)return;
 const [,channel,file]=match;
 event.respondWith(file==='properties'?properties('SPHEREx DR1 · canal '+channel):spectralTile(root,channel,file));
});
