const number = n => new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:5}).format(n);
export function chart(rows) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 440 280');svg.setAttribute('role','group');svg.setAttribute('aria-label','Radiância por comprimento de onda. Pontos acessíveis por teclado; valores na tabela de medições.');svg.classList.add('science-chart');
  function node(tag,attrs,text) { const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v);if(text!=null)n.textContent=text;svg.append(n);return n; }
  const valid=rows.filter(r=>r.radiance !== null), xs=rows.map(r=>r.wavelength), ys=valid.flatMap(r=>[r.radiance-(r.uncertainty || 0),r.radiance+(r.uncertainty || 0)]);
  let loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(0,...ys),hiY=Math.max(0,...ys);
  const padX=(hiX-loX)*.05 || loX*.1, padY=(hiY-loY)*.1 || 1;loX-=padX;hiX+=padX;loY-=padY;hiY+=padY;
  const x=v=>62+(v-loX)/(hiX-loX)*354,y=v=>218-(v-loY)/(hiY-loY)*170;
  for(let i=0;i<=4;i++) {const xv=loX+(hiX-loX)*i/4,yv=loY+(hiY-loY)*i/4;
    node('line',{x1:62,y1:y(yv),x2:416,y2:y(yv),class:'chart-grid'});
    node('text',{x:54,y:y(yv)+4,'text-anchor':'end'},new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:3,notation:Math.abs(yv)>=10000 || (Math.abs(yv)>0 && Math.abs(yv)<.01)?'scientific':'standard'}).format(yv));node('text',{x:x(xv),y:239,'text-anchor':'middle'},new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:3}).format(xv));
  }
  node('path',{d:'M62 48 V218 H416',class:'chart-axis'});
  node('text',{x:230,y:267,'text-anchor':'middle'},`Comprimento de onda (${rows[0].wavelengthUnit})`);
  node('text',{x:18,y:23},`Radiância (${rows[0].radianceUnit})`);
  for(const r of valid) {
    if(r.uncertainty != null) { const yy=y(r.radiance+r.uncertainty), yb=y(r.radiance-r.uncertainty),xx=x(r.wavelength);node('path',{d:`M${xx} ${yy} V${yb} M${xx-4} ${yy} H${xx+4} M${xx-4} ${yb} H${xx+4}`,class:'chart-error'}); }
    const label=`${r.bandId}: ${number(r.wavelength)} ${r.wavelengthUnit}; ${number(r.radiance)} ${r.radianceUnit}${r.uncertainty != null ? ` ± ${number(r.uncertainty)}`:''}`;
    const point=node('circle',{cx:x(r.wavelength),cy:y(r.radiance),r:5,tabindex:0,'aria-label':label,class:'chart-point'});
    const title=document.createElementNS(ns,'title');title.textContent=label;point.append(title);
  }
  return svg;
}
