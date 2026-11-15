export function linearTicks(lo,hi,count=5){
  const raw=(hi-lo)/count;if(!(raw>0))return [lo];const power=10**Math.floor(Math.log10(raw));
  const step=[1,2,2.5,5,10].map(n=>n*power).reduce((a,b)=>Math.abs(a-raw)<Math.abs(b-raw)?a:b);
  const ticks=[];for(let i=Math.ceil(lo/step);i*step<=hi+step*1e-8&&ticks.length<20;i++)ticks.push(Number((i*step).toPrecision(12)));return ticks;
}
const standardTick=new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:4});
const scientificTick=new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:4,notation:'scientific'});
export function formatChartTick(value,locale='pt-BR'){
  const scientific=Math.abs(value)>=10000||(value!==0&&Math.abs(value)<.01);
  const formatter=locale==='pt-BR'?(scientific?scientificTick:standardTick):new Intl.NumberFormat(locale,{maximumSignificantDigits:4,notation:scientific?'scientific':'standard'});
  return formatter.format(value);
}
// A largura muda a projeção dos dados no SVG, nunca seus valores científicos.
export function chartGeometry(series,width=440,height=280,locale='pt-BR'){
  const all=series.flatMap(s=>s.rows),valid=all.filter(r=>Number.isFinite(r.radiance));
  const xs=all.map(r=>r.wavelength).filter(Number.isFinite),ys=valid.flatMap(r=>[r.radiance-(r.uncertainty||0),r.radiance+(r.uncertainty||0)]);
  let loX=xs.length?Math.min(...xs):0,hiX=xs.length?Math.max(...xs):1,loY=Math.min(0,...ys),hiY=Math.max(0,...ys);
  const padX=(hiX-loX)*.05||loX*.1||1,padY=(hiY-loY)*.1||1;loX-=padX;hiX+=padX;loY-=padY;hiY+=padY;
  const top=height<=150?30:height<=210?34:44,bottom=height-56;
  const yTicks=linearTicks(loY,hiY,height<=210?Math.max(2,Math.floor((bottom-top)/24)):5);
  // Reserva espaço para o texto real dos ticks, inclusive expoentes negativos.
  // Estimativa conservadora evita medir o DOM durante o redimensionamento.
  const labelWidth=Math.max(...yTicks.map(value=>formatChartTick(value,locale).length))*7;
  const left=Math.max(width<420?48:56,labelWidth+16),right=width-22;
  return {width,height,left,right,top,bottom,loX,hiX,loY,hiY,
    x:v=>left+(v-loX)/(hiX-loX)*(right-left),y:v=>bottom-(v-loY)/(hiY-loY)*(bottom-top),
    xTicks:linearTicks(loX,hiX,Math.max(3,Math.min(7,Math.floor((right-left)/76)))),yTicks};
}
