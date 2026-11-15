// Apenas geometria de apoio visual: não cria bandas nem interpola valores.
export function measurementSegments(rows) {
  const segments=[];let current=[];
  for(const row of [...rows].sort((a,b)=>a.wavelength-b.wavelength)) {
    if(!Number.isFinite(row.wavelength)||!Number.isFinite(row.radiance)) {
      if(current.length>1)segments.push(current);current=[];
    }else current.push(row);
  }
  if(current.length>1)segments.push(current);
  return segments;
}
export function tracePlan(lengths,duration=.46) {
  const total=lengths.reduce((sum,n)=>sum+Math.max(0,n),0);let start=0;
  return lengths.map(length=>{const time=total>0?duration*Math.max(0,length)/total:duration/lengths.length;const item={start,duration:time};start+=time;return item;});
}
