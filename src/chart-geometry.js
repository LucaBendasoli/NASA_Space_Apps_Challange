export function linearTicks(lo,hi,count=5){
  const raw=(hi-lo)/count;if(!(raw>0))return [lo];const power=10**Math.floor(Math.log10(raw));
  const step=[1,2,2.5,5,10].map(n=>n*power).reduce((a,b)=>Math.abs(a-raw)<Math.abs(b-raw)?a:b);
  const ticks=[];for(let i=Math.ceil(lo/step);i*step<=hi+step*1e-8&&ticks.length<20;i++)ticks.push(Number((i*step).toPrecision(12)));return ticks;
}
// A largura muda a projeção dos dados no SVG, nunca seus valores científicos.
export function chartGeometry(series,width=440,height=280){
  const all=series.flatMap(s=>s.rows),valid=all.filter(r=>Number.isFinite(r.radiance));
  const xs=all.map(r=>r.wavelength).filter(Number.isFinite),ys=valid.flatMap(r=>[r.radiance-(r.uncertainty||0),r.radiance+(r.uncertainty||0)]);
  let loX=xs.length?Math.min(...xs):0,hiX=xs.length?Math.max(...xs):1,loY=Math.min(0,...ys),hiY=Math.max(0,...ys);
  const padX=(hiX-loX)*.05||loX*.1||1,padY=(hiY-loY)*.1||1;loX-=padX;hiX+=padX;loY-=padY;hiY+=padY;
  const left=width<420?52:62,right=width-18,top=height<=210?30:40,bottom=height-(height<=210?42:52);
  return {width,height,left,right,top,bottom,loX,hiX,loY,hiY,
    x:v=>left+(v-loX)/(hiX-loX)*(right-left),y:v=>bottom-(v-loY)/(hiY-loY)*(bottom-top),
    xTicks:linearTicks(loX,hiX,Math.max(4,Math.min(7,Math.floor((right-left)/70)))),yTicks:linearTicks(loY,hiY,height<=210?4:5)};
}
