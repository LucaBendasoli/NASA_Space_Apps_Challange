'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown, CircleHelp, Crosshair, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { formatDate } from '../lib/spectrum';
import type { CelestialObject } from '../lib/spectrum';

export type SpectrumExplorerProps = {
  objects: CelestialObject[];
  title?: string;
  radianceUnit?: string;
  valueLabel?: string;
  bandCount?: number;
  spectralRegion?: string;
  onRangeChange?: (range: [number, number]) => void;
};
const temporalColors = ['#9d8bff', '#52d6c7', '#f2ba72'];
const number = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits });

/** Wavelengths in micrometers. Points are sorted locally; input data is never mutated. */
export function SpectrumExplorer({ objects, title = 'Assinatura espectral', radianceUnit = 'MJy/sr', valueLabel = 'Radiância', bandCount = 102, spectralRegion = 'Infravermelho médio', onRangeChange }: SpectrumExplorerProps) {
  const uid = useId().replace(/:/g, '');
  const [mode, setMode] = useState<'objects' | 'dates'>('objects');
  const [selected, setSelected] = useState<string[]>(objects.slice(0, 3).map(o => o.id));
  const [objectId, setObjectId] = useState(objects[0]?.id ?? '');
  const [hiddenDates, setHiddenDates] = useState<string[]>([]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const allPoints = objects.flatMap(o => o.observations.flatMap(s => s.points)).filter(p => Number.isFinite(p.wavelength) && Number.isFinite(p.radiance));
  const domain: [number, number] = allPoints.length ? [Math.min(...allPoints.map(p => p.wavelength)), Math.max(...allPoints.map(p => p.wavelength))] : [5, 28];
  if (domain[0] === domain[1]) domain[1] = domain[0] + 1;
  const lo = Math.max(domain[0], Math.min(range?.[0] ?? domain[0], domain[1]));
  const hi = Math.max(lo + .001, Math.min(range?.[1] ?? domain[1], domain[1]));
  const activeObject = objects.find(o => o.id === objectId) ?? objects[0];
  const series = useMemo(() => (mode === 'objects'
    ? objects.filter(o => selected.includes(o.id)).flatMap(o => o.observations[0] ? [{ id: o.id, name: o.name, color: o.color, observation: o.observations[0] }] : [])
    : (activeObject?.observations ?? []).map((o, i) => ({ id: o.id, name: formatDate(o.date), color: temporalColors[i % temporalColors.length], observation: o })).filter(s => !hiddenDates.includes(s.id)))
    .map(s => ({ ...s, points: s.observation.points.filter(p => Number.isFinite(p.wavelength) && Number.isFinite(p.radiance)).sort((a, b) => a.wavelength - b.wavelength) })), [objects, mode, selected, activeObject, hiddenDates]);
  const visible = series.flatMap(s => s.points.filter(p => p.wavelength >= lo && p.wavelength <= hi));
  const yMin = Math.min(0, ...visible.map(p => p.radiance));
  const yMax = Math.max(0, ...visible.map(p => p.radiance)) * 1.12 || 1;
  const formatValue = (v: number) => v === 0 ? '0' : new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 4 }).format(v);
  const W = 1000, H = 345, left = 65, right = 22, top = 20, bottom = 48;
  const x = (v: number) => left + (v - lo) / (hi - lo) * (W - left - right);
  const y = (v: number) => H - bottom - (v - yMin) / (yMax - yMin) * (H - top - bottom);
  const reference = visible;
  const cursor = hover === null || !reference.length ? null : reference.reduce((a, b) => Math.abs(a.wavelength - hover) < Math.abs(b.wavelength - hover) ? a : b).wavelength;
  const nearest = (points: typeof visible, wavelength: number) => points.length ? points.reduce((a, b) => Math.abs(a.wavelength - wavelength) < Math.abs(b.wavelength - wavelength) ? a : b) : undefined;
  const updateRange = (next: [number, number]) => { setRange(next); setHover(null); onRangeChange?.(next); };
  const exportCsv = () => {
    const rows = [['serie', 'observacao', 'comprimento_onda_um', `${valueLabel}_${radianceUnit}`], ...series.flatMap(s => s.points.filter(p => p.wavelength >= lo && p.wavelength <= hi).map(p => [s.name, s.observation.date, p.wavelength, p.radiance]))];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'espectros.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return <section className="spectrum-card" aria-label={title}>
    <div className="chart-header"><div><h2>{title} <span className="badge">{bandCount} BANDAS</span></h2><p>Explore a distribuição de {valueLabel.toLocaleLowerCase()} em diferentes comprimentos de onda.</p></div><button className="button export" onClick={exportCsv} disabled={!visible.length}><ArrowDownToLine size={15}/>Exportar CSV</button></div>
    <div className="chart-toolbar"><div className="tabs" role="tablist" aria-label="Modo de comparação"><button role="tab" aria-selected={mode === 'objects'} className={mode === 'objects' ? 'selected' : ''} onClick={() => { setMode('objects'); setHover(null); }}>Comparar astros</button><button role="tab" aria-selected={mode === 'dates'} className={mode === 'dates' ? 'selected' : ''} onClick={() => { setMode('dates'); setHover(null); }}>Comparar observações</button></div><span className="toolbar-detail"><span className="tiny-dot"/> {spectralRegion}</span></div>
    <div className="selection-row"><div className="legend">{series.map(s => <span key={s.id}><i style={{ background: s.color }}/>{s.name}</span>)}{!series.length && <span>Nenhuma série selecionada</span>}</div><div className="picker-wrap"><button className="button" onClick={() => setPicker(!picker)} aria-expanded={picker} aria-controls={`${uid}-picker`}><SlidersHorizontal size={14}/>{mode === 'objects' ? 'Selecionar astros' : 'Selecionar observações'}<ChevronDown size={13}/></button>{picker && <div className="picker" id={`${uid}-picker`}>{mode === 'dates' && <label className="object-label">Astro<select value={activeObject?.id ?? ''} onChange={e => { setObjectId(e.target.value); setHiddenDates([]); }}>{objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}{mode === 'objects' && <input className="catalog-search" aria-label="Buscar astro nesta página" placeholder="Buscar nome ou ID nesta página" value={search} onChange={e => setSearch(e.target.value)}/>} {mode === 'objects' ? objects.filter(o => `${o.id} ${o.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(o => <label key={o.id}><input type="checkbox" checked={selected.includes(o.id)} onChange={() => setSelected(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}/><span>{o.name}<small>{o.id} · {o.category}</small></span></label>) : activeObject?.observations.map(o => <label key={o.id}><input type="checkbox" checked={!hiddenDates.includes(o.id)} onChange={() => setHiddenDates(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}/><span>{formatDate(o.date)}<small>{o.label}</small></span></label>)}<button className="button picker-done" onClick={() => setPicker(false)}><Check size={14}/>Concluir</button></div>}</div></div>
    <div className="plot-heading"><span>{valueLabel} <span>({radianceUnit})</span></span><span><Crosshair size={12}/> Passe sobre o gráfico para inspecionar</span></div>
    <div className="plot-wrap"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Espectro de ${series.map(s => s.name).join(', ') || 'nenhum astro'}. Eixo X: comprimento de onda em micrômetros. Eixo Y: ${valueLabel} em ${radianceUnit}.`} onPointerLeave={() => setHover(null)} onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const vx = (e.clientX - rect.left) / rect.width * W; setHover(lo + Math.max(0, Math.min(1, (vx - left) / (W - left - right))) * (hi - lo)); }}>
      <defs><clipPath id={`${uid}-clip`}><rect x={left} y={top} width={W-left-right} height={H-top-bottom}/></clipPath>{series.map(s => <linearGradient id={`${uid}-${s.id}`} key={s.id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".14"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>)}</defs>
      {Array.from({ length: 5 }, (_, i) => { const v = yMin + (yMax-yMin) * i / 4; return <g key={i}><line x1={left} x2={W-right} y1={y(v)} y2={y(v)} stroke="#292b39" strokeDasharray="3 5"/><text x={left-15} y={y(v)+4} textAnchor="end">{formatValue(v)}</text></g>; })}
      {Array.from({ length: 9 }, (_, i) => { const v = lo + (hi-lo) * i / 8; return <g key={i}><line x1={x(v)} x2={x(v)} y1={top} y2={H-bottom} stroke="#232532" strokeDasharray="3 5"/><text x={x(v)} y={H-bottom+25} textAnchor="middle">{number(v)}</text></g>; })}
      <g clipPath={`url(#${uid}-clip)`}>{series.map(s => { const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.wavelength)},${y(p.radiance)}`).join(' '); return <g key={s.id}>{s.points.length > 0 && <path d={`${path} L${x(s.points.at(-1)!.wavelength)},${y(0)} L${x(s.points[0].wavelength)},${y(0)} Z`} fill={`url(#${uid}-${s.id})`}/>}{s.points.length === 1 && <circle cx={x(s.points[0].wavelength)} cy={y(s.points[0].radiance)} r="4" fill={s.color}/>}<path d={path} fill="none" stroke={s.color} strokeWidth="2.3" strokeLinejoin="round"/>{cursor !== null && (() => { const p = nearest(s.points, cursor); return p ? <circle cx={x(p.wavelength)} cy={y(p.radiance)} r="4" fill={s.color} stroke="#171822" strokeWidth="2"/> : null; })()}</g>; })}{cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={top} y2={H-bottom} stroke="#b2adc7" strokeDasharray="4 4"/>}</g>
      <text x={W/2} y={H-2} textAnchor="middle">Comprimento de onda (μm)</text>
    </svg>{!visible.length && <div className="empty">Nenhum dado neste intervalo. Selecione uma série ou amplie o filtro.</div>}{cursor !== null && <div className="tooltip" style={{ left: `${Math.min(76, Math.max(9, x(cursor)/W*100))}%` }}><strong>{number(cursor, 3)} μm</strong>{series.map(s => <div key={s.id}><i style={{ background: s.color }}/>{s.name}<b>{(() => { const p = nearest(s.points, cursor); return p ? `${formatValue(p.radiance)} @ ${number(p.wavelength, 3)} μm` : 'Sem dados'; })()}</b></div>)}<small>{valueLabel} em {radianceUnit}</small></div>}</div>
    <div className="range-panel"><div className="range-heading"><label htmlFor={`${uid}-min`}><SlidersHorizontal size={14}/>Intervalo espectral</label><span>{number(lo, 2)} <span>—</span> {number(hi, 2)} μm</span><button onClick={() => updateRange(domain)} aria-label="Restaurar intervalo completo"><RotateCcw size={13}/>Restaurar</button></div><div className="range-inputs"><label>Mínimo<input id={`${uid}-min`} type="range" min={domain[0]} max={domain[1]} step="0.01" value={lo} onChange={e => updateRange([Math.min(+e.target.value, hi-.01), hi])}/></label><label>Máximo<input aria-label="Comprimento de onda máximo" type="range" min={domain[0]} max={domain[1]} step="0.01" value={hi} onChange={e => updateRange([lo, Math.max(+e.target.value, lo+.01)])}/></label></div><div className="range-scale"><span>{number(domain[0])} μm</span><span>Arraste para explorar uma região do espectro</span><span>{number(domain[1])} μm</span></div></div>
    <div className="chart-footnote"><CircleHelp size={13}/>{mode === 'objects' ? 'Exibindo a primeira observação fornecida de cada astro selecionado.' : `Comparando observações de ${activeObject?.name ?? 'nenhum astro'}.`}<span>{visible.length} pontos visíveis</span></div>
  </section>;
}
