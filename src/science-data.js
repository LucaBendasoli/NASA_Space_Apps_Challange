import { validCoordinates } from './sky-model.js';
import { validateObservationDate } from './observation-date.js';

const required = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} ausente no contrato.`);
  return value;
};
export const objectKey = o => JSON.stringify([o.surveyId, o.observationId, o.id]);
export function normalizeObject(o, context) {
  required(o.id, 'Identificador'); required(o.observationId, 'Observação');
  if (o.frame !== 'ICRS' || !validCoordinates(o.ra, o.dec)) throw new Error('Coordenadas ICRS em graus obrigatórias; pixels exigem conversão astrométrica pelo backend.');
  if (o.surveyId !== context.surveyId || (context.observationId && o.observationId !== context.observationId)) throw new Error('Objeto de contexto incompatível.');
  for(const key of ['name','observationName','datasetId','datasetName','imageId'])if(o[key]!=null && typeof o[key]!=='string')throw Error(`Campo ${key} inválido.`);
  if(o.observedAt!=null)validateObservationDate(o.observedAt);
  return { id: o.id, name: o.name || o.id, observationId: o.observationId, surveyId: o.surveyId, frame: o.frame, ra: o.ra, dec: o.dec, observationName:o.observationName, datasetId:o.datasetId, datasetName:o.datasetName,observedAt:o.observedAt,imageId:o.imageId };
}
export function normalizeObservations(payload,object,limit=100) {
  if(!payload||typeof payload!=='object')throw Error('Resposta de histórico inválida.');
  if(payload.id!==object.id||payload.surveyId!==object.surveyId||payload.referenceObservationId!==object.observationId)throw Error('Histórico de outro astro, levantamento ou observação de referência.');
  if(!Array.isArray(payload.observations)||payload.observations.length>limit||typeof payload.complete!=='boolean')throw Error('Lista de observações inválida ou acima do limite.');
  const observations=payload.observations.map(entry=>{
    if(!entry||entry.id!==object.id)throw Error('O histórico contém outro astro ou registro inválido.');
    validateObservationDate(entry.observedAt);
    const normalized=normalizeObject(entry,{surveyId:object.surveyId});
    if(normalized.observationId===object.observationId&&object.observedAt&&Date.parse(normalized.observedAt)!==Date.parse(object.observedAt))throw Error('Data da observação de referência divergente.');
    return normalized;
  }).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.observationId.localeCompare(b.observationId));
  if(new Set(observations.map(objectKey)).size!==observations.length)throw Error('Observação duplicada no histórico.');
  return {observations,partial:!payload.complete||Boolean(payload.nextCursor)};
}
export function normalizeMeasurements(payload, object) {
  if (objectKey(payload) !== objectKey(object)) throw new Error('Medições de outro astro ou observação.');
  if(payload.observedAt!=null){validateObservationDate(payload.observedAt);if(object.observedAt&&Date.parse(payload.observedAt)!==Date.parse(object.observedAt))throw Error('Data das medições divergente da observação selecionada.');}
  if (payload.quantity !== 'radiance') throw new Error('O backend precisa fornecer radiância, sem conversão de fluxo ou magnitude.');
  if (!Array.isArray(payload.measurements)) throw new Error('Lista de medições inválida.');
  const seen = new Set();
  const rows = payload.measurements.map(m => {
    required(m.bandId, 'Banda'); required(m.wavelengthUnit, 'Unidade de comprimento de onda'); required(m.radianceUnit, 'Unidade de radiância');
    if (seen.has(m.bandId)) throw new Error('Banda duplicada.');
    seen.add(m.bandId);
    if (!Number.isFinite(m.wavelength) || m.wavelength <= 0) throw new Error('Comprimento de onda inválido.');
    if (m.radiance != null && !Number.isFinite(m.radiance)) throw new Error('Radiância não finita.');
    if (m.radiance < 0 && payload.allowNegative !== true) throw new Error('Radiância negativa não autorizada pelo contrato.');
    if (m.uncertainty != null && (!Number.isFinite(m.uncertainty) || m.uncertainty < 0)) throw new Error('Incerteza inválida.');
    return { ...m, radiance: m.radiance ?? null };
  }).sort((a, b) => a.wavelength - b.wavelength);
  if (new Set(rows.map(m => m.wavelengthUnit)).size > 1 || new Set(rows.map(m => m.radianceUnit)).size > 1) throw new Error('Unidades incompatíveis; o backend deve uniformizá-las.');
  return { rows, incomplete: payload.complete !== true };
}
export function angularDistance(a, b) {
  const r = Math.PI / 180;
  return Math.acos(Math.min(1, Math.max(-1, Math.sin(a.dec*r)*Math.sin(b.dec*r)+Math.cos(a.dec*r)*Math.cos(b.dec*r)*Math.cos((a.ra-b.ra)*r)))) / r;
}
export function visibleContext(aladin, surveyId, observationId) {
  const [ra, dec] = aladin.getRaDec(), [width, height] = aladin.getFov();
  // Cone conservador: soma das semiextensões, acrescida das bordas projetadas.
  let radius = (width + height) / 2;
  try { for (const [r, d] of aladin.getFoVCorners(8, 'ICRS')) if (validCoordinates(r, d)) radius = Math.max(radius, angularDistance({ra, dec}, {ra:r, dec:d})); } catch { radius = 180; }
  return { ra, dec, width, height, radius, surveyId, observationId };
}
export function sourceInField(aladin,object) {
  try {const point=aladin.world2pix(object.ra,object.dec),[w,h]=aladin.getSize();if(!point)return false;if(!point.every(Number.isFinite))return null;return point[0]>=0&&point[0]<=w&&point[1]>=0&&point[1]<=h;}catch{return null;}
}
export function createProvider(config, fetcher = fetch) {
  async function get(path, params, signal) {
    const url = new URL(path, new URL(config.baseURL, globalThis.location?.href || 'http://localhost/'));
    for (const [k,v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
    let response;
    try { response = await fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)) }); }
    catch(error) {
      if (signal?.aborted) throw error;
      throw new Error(error.name === 'TimeoutError' ? 'A API científica demorou demais. Tente novamente.' : 'Não foi possível acessar a API científica. Verifique a conexão e a configuração do serviço.');
    }
    if (!response.ok) throw new Error(`API científica: HTTP ${response.status}.`);
    return response.json();
  }
  return {
    async object(reference,signal) {
      let object;
      if(config.provider==='demo') {
        object=demoList({ra:10.68,dec:41.27,radius:5,surveyId:reference.surveyId}).objects.find(o=>o.id===reference.id&&o.observationId===reference.observationId);
        if(!object)throw Error('Fonte compartilhada não encontrada na demonstração.');
      }else object=await get(`objects/${encodeURIComponent(reference.id)}`,{surveyId:reference.surveyId,observationId:reference.observationId},signal);
      const normalized=normalizeObject(object,reference);
      if(objectKey(normalized)!==objectKey(reference))throw Error('A fonte recuperada não corresponde à análise compartilhada.');
      return normalized;
    },
    async list(context, signal) {
      const payload = config.provider === 'demo' ? demoList(context) : await get('objects', { ...context, limit: config.limit }, signal);
      if (!Array.isArray(payload.objects) || !['none','partial','full'].includes(payload.coverage) || typeof payload.complete !== 'boolean') throw new Error('Resposta regional inválida.');
      if (payload.objects.length > config.limit) throw new Error('API excedeu o limite regional.');
      const objects = payload.objects.map(o => normalizeObject(o, context));
      if (new Set(objects.map(objectKey)).size !== objects.length) throw new Error('Objetos duplicados na região.');
      return { objects, coverage: payload.coverage, partial: !payload.complete || Boolean(payload.nextCursor) };
    },
    async measurements(object, signal) {
      const payload = config.provider === 'demo' ? demoMeasurements(object) : await get(`objects/${encodeURIComponent(object.id)}/measurements`, { surveyId: object.surveyId, observationId: object.observationId }, signal);
      return normalizeMeasurements(payload, object);
    },
    async observations(object,signal) {
      const limit=config.historyLimit||100;
      const payload=config.provider==='demo'?demoObservations(object):await get(`objects/${encodeURIComponent(object.id)}/observations`,{surveyId:object.surveyId,referenceObservationId:object.observationId,limit},signal);
      return normalizeObservations(payload,object,limit);
    },
  };
}
function demoList(c) {
  const objects = [{id:'demo-a',name:'Fonte simulada A',ra:10.684708,dec:41.26875}, {id:'demo-b',name:'Fonte simulada B',ra:10.94,dec:41.38}, {id:'demo-empty',name:'Fonte simulada sem medições',ra:10.42,dec:41.18}].map(o => ({...o,frame:'ICRS',surveyId:c.surveyId,observationId:'demo-observation',observationName:'Observação simulada',observedAt:'2025-01-15T03:00:00Z',imageId:'demo-image-2025',datasetId:'demo-ir',datasetName:'Conjunto simulado de infravermelho'})).filter(o => angularDistance(c,o) <= c.radius && (!c.observationId || c.observationId === o.observationId));
  return {objects,coverage:angularDistance(c,{ra:10.68,dec:41.27}) > c.radius+2 ? 'none':'full',complete:true};
}
function demoMeasurements(o) {
  const epoch=o.observationId==='demo-observation-2023'?1:o.observationId==='demo-observation-2024'?2:0;
  const waves=epoch===1?[1.3,1.8,2.4,5,11]:epoch===2?[1.2,1.7,2.3,4.8,13]:[1.25,1.65,2.17,4.6,12];
  const radiances=epoch===1?[.6,1.8,2.7,2.5,4.1]:epoch===2?[1.7,2.8,null,3.2,2.1]:o.id==='demo-b'?[null,0,-.3,2,4]:[1,2.4,1.7,3.8,2.9];
  return {...o,quantity:'radiance',allowNegative:true,complete:o.id !== 'demo-b'&&epoch!==2,measurements:o.id === 'demo-empty' ? [] : waves.map((w,i)=>({bandId:`SIM-${i+1}`,wavelength:w,wavelengthUnit:'µm',radiance:radiances[i],radianceUnit:'W m⁻² sr⁻¹ µm⁻¹',uncertainty:.15,quality:'simulado'}))};
}
function demoObservations(object) {
  const observations=object.id==='demo-empty'?[]:[object,...[2023,2024].map(year=>({...object,observationId:`demo-observation-${year}`,observationName:`Observação simulada de ${year}`,observedAt:`${year}-01-15T03:00:00Z`,imageId:`demo-image-${year}`}))];
  return {id:object.id,surveyId:object.surveyId,referenceObservationId:object.observationId,complete:true,observations};
}
