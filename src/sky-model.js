// Código próprio: coordenadas ICRS em graus, lista didática e estado da interface.
export const TARGETS = [
  { id: 'm31', name: 'Galáxia de Andrômeda', aliases: ['M31', 'Andromeda', 'Andrômeda', 'NGC 224'], ra: 10.684708, dec: 41.26875, fov: 3 },
  { id: 'm42', name: 'Nebulosa de Órion', aliases: ['M42', 'Orion', 'Órion', 'NGC 1976'], ra: 83.822083, dec: -5.391111, fov: 1.6 },
  { id: 'pleiades', name: 'As Plêiades', aliases: ['M45', 'Pleiades', 'Plêiades'], ra: 56.75, dec: 24.116667, fov: 2.5 },
  { id: 'sirius', name: 'Sirius', aliases: ['Sirius', 'Sírius'], ra: 101.287155, dec: -16.716116, fov: 1 },
  { id: 'm51', name: 'Galáxia do Redemoinho', aliases: ['M51', 'NGC 5194'], ra: 202.469583, dec: 47.195278, fov: .4 },
  { id: 'm13', name: 'Aglomerado de Hércules', aliases: ['M13', 'NGC 6205'], ra: 250.423475, dec: 36.461319, fov: .6 },
  { id: 'm1', name: 'Nebulosa do Caranguejo', aliases: ['M1', 'NGC 1952'], ra: 83.633083, dec: 22.0145, fov: .3 },
  { id: 'sgr-a', name: 'Centro da Via Láctea', aliases: ['Sgr A*', 'Sagittarius A*', 'Centro galáctico'], ra: 266.416833, dec: -29.007806, fov: 5 },
];
export const SURVEYS = {
  dss: { label: 'DSS2 · Luz visível', description: 'Uma visão do céu em luz visível, composta por placas fotográficas digitalizadas.', urls: { esa: 'https://skies.esac.esa.int/DSSColor', china: 'https://hips.china-vo.org/m/CDS_P_DSS2_color' } },
  '2mass': { label: '2MASS · Infravermelho próximo', description: 'O céu em três bandas do infravermelho próximo. Compare estrelas e regiões de poeira com a visão óptica.', urls: { esa: 'https://skies.esac.esa.int/2MASSColor', china: 'https://hips.china-vo.org/m/CDS_P_2MASS_color' } },
  wise: { label: 'AllWISE · Infravermelho', description: 'Um levantamento no infravermelho que revela emissões de poeira e objetos frios.', urls: { esa: 'https://skies.esac.esa.int/AllWISEColor', china: 'https://hips.china-vo.org/m/CDS_P_allWISE_color' } },
  sdss: { label: 'SDSS9 · Luz visível', description: 'Levantamento óptico com cobertura parcial: uma área escura pode estar fora da região observada.', urls: { esa: 'https://skies.esac.esa.int/SDSS9Color', china: 'https://hips.china-vo.org/m/CDS_P_SDSS9_color' } },
};
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').trim();
export function findTarget(query) {
  const key = normalize(query);
  return TARGETS.find(t => [t.id, t.name, ...t.aliases].some(a => normalize(a) === key));
}
export function validCoordinates(ra, dec) {
  return Number.isFinite(ra) && Number.isFinite(dec) && ra >= 0 && ra < 360 && dec >= -90 && dec <= 90;
}
export function parseCoordinates(query) {
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const match = query.trim().match(new RegExp(`^(${number})(?:\\s*,\\s*|\\s+)(${number})$`));
  if (!match) return null;
  const ra = Number(match[1]), dec = Number(match[2]);
  if (!validCoordinates(ra, dec)) throw new Error('Use RA entre 0 e menos de 360° e Dec entre −90 e +90°.');
  return { ra, dec };
}
export function parseSesame(text) {
  const match = text.match(/^%J\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)/m);
  if (!match || !validCoordinates(Number(match[1]), Number(match[2]))) throw new Error('Objeto não encontrado no Sesame. Tente M31 ou coordenadas em graus.');
  return { ra: Number(match[1]), dec: Number(match[2]) };
}
export function readView(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const ra = Number(p.get('ra')), dec = Number(p.get('dec')), fov = Number(p.get('fov'));
  if (!p.get('ra')?.trim() || !p.get('dec')?.trim() || !validCoordinates(ra, dec) || !validFov(fov)) return null;
  return { ra, dec, fov, survey: Object.hasOwn(SURVEYS, p.get('survey')) ? p.get('survey') : 'dss', projection: ['SIN', 'AIT', 'MOL'].includes(p.get('projection')) ? p.get('projection') : 'SIN' };
}
export function viewHash({ ra, dec, fov, survey, projection }) {
  if (!validCoordinates(ra, dec) || !validFov(fov)) throw new Error('Estado de visualização inválido.');
  // String(number) preserva o valor IEEE-754 ao reler, sem arredondar FoV a zero
  // ou transformar uma RA próxima de 360° em uma coordenada inválida.
  return new URLSearchParams({ ra: String(ra), dec: String(dec), fov: String(fov), survey, projection }).toString();
}
function validFov(fov) {
  // O motor aplica o limite físico de zoom. O link só valida um ângulo positivo.
  return Number.isFinite(fov) && fov > 0 && fov <= 360;
}
export function formatDegrees(value, signed = false) {
  return `${signed && value >= 0 ? '+' : ''}${value.toFixed(8)}°`;
}
export function formatFov(degrees) {
  if (!validFov(degrees)) return '—';
  if (degrees >= 1) return `${degrees.toFixed(3)}°`;
  if (degrees >= 1 / 60) return `${(degrees * 60).toFixed(2)}′`;
  const arcseconds = degrees * 3600;
  return `${arcseconds < .001 ? arcseconds.toExponential(2) : arcseconds.toFixed(3)}″`;
}
