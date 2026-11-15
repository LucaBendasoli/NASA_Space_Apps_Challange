let skyMap;
byId('region-mode').onclick=()=>mode(false);
byId('global-mode').onclick=()=>mode(true);
function mode(global){
 byId('global').classList.toggle('hidden',!global);
 byId('analysis').classList.toggle('hidden',global);
 byId('global-mode').setAttribute('aria-pressed',global);
 byId('region-mode').setAttribute('aria-pressed',!global);
 if(global){
  if(!skyMap)skyMap=createSkyMap();
  skyMap.draw();
 }
}
function createSkyMap(){
 const canvas=byId('sky-canvas'), ctx=canvas.getContext('2d');
 const image=new Image();
 let ra=180,dec=0,span=360,drag=null;
 const color = new Map(Object.keys(regions).map((k,i)=>[k,['#ffbf86','#8ad2ff','#a3e8ca'][i]]));
 let points=[];
 function geometry(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const vertical=span*h/w;
  return {w,h,vertical};
 }
 function draw(){
  if(!canvas.clientWidth)return;
  const {w,h,vertical}=geometry(), d=devicePixelRatio||1;
  canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
  ctx.setTransform(d,0,0,d,0,0);
  ctx.fillStyle='#050811';ctx.fillRect(0,0,w,h);
  if(image.complete&&image.naturalWidth){
   const sheetW=w*360/span,sheetH=h*180/vertical;
   for(const wrap of [-360,0,360]){
    const left=w/2+(-ra+wrap)*w/span, top=h/2+(dec-90)*h/vertical;
    ctx.drawImage(image,left,top,sheetW,sheetH);
   }
  }
  points=[];
  for(const [id,r] of Object.entries(regions)){
   const delta=((r.center[0]-ra+540)%360)-180;
   const x=w/2+delta*w/span,y=h/2+(dec-r.center[1])*h/vertical;
   if(x<0||x>w||y<0||y>h)continue;
   points.push({id,x,y});
   ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle=color.get(id);ctx.fill();
   ctx.font='bold 12px system-ui';ctx.lineWidth=4;ctx.strokeStyle='#080d17';
   const right=x+ctx.measureText(r.name).width+11<=w;
   ctx.textAlign=right?'left':'right';
   ctx.strokeText(r.name,x+(right?10:-10),y-10);ctx.fillText(r.name,x+(right?10:-10),y-10);
  }
  byId('map-position').textContent='Centro · RA '+fmt(ra,2)+'° · Dec '+fmt(dec,2)+'° · campo '+fmt(span,1)+'°';
 }
 const clamp=()=>{ra=(ra%360+360)%360;dec=Math.max(-89,Math.min(89,dec));span=Math.max(4,Math.min(360,span))};
 const zoom=f=>{span*=f;clamp();draw()};
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.2:1/1.2)},{passive:false});
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ra,dec};canvas.setPointerCapture(e.pointerId)};
 canvas.onpointermove=e=>{if(!drag)return;const {w,h,vertical}=geometry();ra=drag.ra-(e.clientX-drag.x)*span/w;dec=drag.dec+(e.clientY-drag.y)*vertical/h;clamp();draw()};
 canvas.onpointercancel=()=>{drag=null};
 canvas.onpointerup=e=>{
  if(drag&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6){
   const box=canvas.getBoundingClientRect();
   const hit=points.find(p=>Math.hypot(p.x-e.clientX+box.left,p.y-e.clientY+box.top)<13);
   if(hit){regionSelect.value=hit.id;regionSelect.onchange()}
  }
  drag=null;
 };
 canvas.onkeydown=e=>{
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
  if(!directions[e.key])return;
  e.preventDefault();const [x,y]=directions[e.key];ra+=x*span/8;dec+=y*span/8;clamp();draw();
 };
 byId('sky-wide').onclick=()=>{ra=180;dec=0;span=360;draw()};
 byId('sky-region').onclick=()=>{[ra,dec]=data.center;span=24;draw()};
 byId('sky-plus').onclick=()=>zoom(.7);
 byId('sky-minus').onclick=()=>zoom(1/.7);
 new ResizeObserver(draw).observe(canvas);
 image.onload=draw;
 image.onerror=()=>{byId('map-status').textContent='Imagem panorâmica indisponível. Os recortes já estão no painel de regiões.'};
 image.src='sky.webp';
 return {draw};
}
