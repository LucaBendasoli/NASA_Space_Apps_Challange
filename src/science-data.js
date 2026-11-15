import { validCoordinates } from './sky-model.js';

const required = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} ausente no contrato.`);
  return value;
};
export const objectKey = o => JSON.stringify([o.surveyId, o.observationId, o.id]);
export function normalizeObject(o, context) {
  required(o.id, 'Identificador'); required(o.observationId, 'Observação');
  if (o.frame !== 'ICRS' || !validCoordinates(o.ra, o.dec)) throw new Error('Coordenadas ICRS em graus obrigatórias; pixels exigem conversão astrométrica pelo backend.');
  if (o.surveyId !== context.surveyId || (context.observationId && o.observationId !== context.observationId)) throw new Error('Objeto de contexto incompatível.');
  return { id: o.id, name: o.name || o.id, observationId: o.observationId, surveyId: o.surveyId, frame: o.frame, ra: o.ra, dec: o.dec };
}
export function normalizeMeasurements(payload, object) {
  if (objectKey(payload) !== objectKey(object)) throw new Error('Medições de outro astro ou observação.');
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
  };
}
function demoList(c) {
  const objects = [{id:'demo-a',name:'Fonte simulada A',ra:10.684708,dec:41.26875}, {id:'demo-b',name:'Fonte simulada B',ra:10.94,dec:41.38}, {id:'demo-empty',name:'Fonte simulada sem medições',ra:10.42,dec:41.18}].map(o => ({...o,frame:'ICRS',surveyId:c.surveyId,observationId:'demo-observation'})).filter(o => angularDistance(c,o) <= c.radius && (!c.observationId || c.observationId === o.observationId));
  return {objects,coverage:angularDistance(c,{ra:10.68,dec:41.27}) > c.radius+2 ? 'none':'full',complete:true};
}
function demoMeasurements(o) {
  return {...o,quantity:'radiance',allowNegative:true,complete:o.id !== 'demo-b',measurements:o.id === 'demo-empty' ? [] : [1.25,1.65,2.17,4.6,12].map((w,i)=>({bandId:`SIM-${i+1}`,wavelength:w,wavelengthUnit:'µm',radiance:o.id === 'demo-b' ? [null,0,-.3,2,4][i] : [1,2.4,1.7,3.8,2.9][i],radianceUnit:'W m⁻² sr⁻¹ µm⁻¹',uncertainty:.15,quality:'simulado'}))};
}
